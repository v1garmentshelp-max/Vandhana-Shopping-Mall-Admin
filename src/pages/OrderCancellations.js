import React, { useEffect, useState } from 'react'
import Navbar from './NavbarAdmin'
import './CommerceOperations.css'
const API = 'https://vandhana-shopping-mall-backend.vercel.app/api/storefront/admin'
const rupees = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0) / 100)
async function request(path, body) {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token') || localStorage.getItem('token') || localStorage.getItem('adminToken') || ''
  const response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.')
  return data
}
export default function OrderCancellations() {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [rejectReasons,setRejectReasons]=useState({})
  const [refs, setRefs] = useState({}), [confirmed, setConfirmed] = useState({})
  const load = async () => { try { setRows(await request('/cancellations')); setError('') } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const act = async (id, endpoint, body) => {
    if (busy) return
    setBusy(id); setError(''); setMessage('')
    try { const result = await request(`/cancellations/${id}/${endpoint}`, body); await load(); setMessage(result.message || 'Refund verified and recorded.') }
    catch (e) { await load(); setError(e.message) }
    finally { setBusy('') }
  }
  return <><Navbar /><main className="v1-operations"><div className="v1-operations-heading"><div><p>ORDER OPERATIONS</p><h1>Cancellation requests</h1></div><button onClick={load} disabled={!!busy}>Refresh</button></div>
    <p>Requests pause dispatch immediately. Confirm carrier cancellation before restoring stock and points. Product-only refunds exclude delivery and COD fees.</p>
    {error && <p role="alert" className="v1-operations-error">{error}</p>}{message && <p role="status" className="v1-operations-success">{message}</p>}
    {loading ? <p role="status">Loading requests...</p> : rows.length === 0 ? <p>No cancellation requests.</p> : rows.map(row => <article key={row.sale_id} className="v1-operations-card"><div><h2>{row.customer_name || 'Customer'} · {row.status.replace(/_/g, ' ')}</h2><p className="v1-operations-id">{row.sale_id}</p><p>{new Date(row.created_at).toLocaleString('en-IN')} · {row.payment_method}</p><p><strong>Reason:</strong> {row.reason}</p></div>
      <div className="v1-operations-totals"><p>Product refund <strong>{rupees(row.refund_amount_paise)}</strong></p><p>Excluded delivery / COD <strong>{rupees(row.excluded_fees_paise)}</strong></p><p>Redeemed points <strong>{row.refund_points}</strong></p><p>Refund status <strong>{row.refund_status.replace(/_/g, ' ')}</strong></p></div>
      {row.last_error && <p className="v1-operations-error">{row.last_error}</p>}
      {['REQUESTED', 'REVIEW_REQUIRED'].includes(row.status) && <button disabled={!!busy} onClick={() => act(row.sale_id, 'process', {})}>{busy === row.sale_id ? 'Verifying carrier and payment...' : row.carrier_attempted ? 'Recheck carrier cancellation' : 'Confirm cancellation'}</button>}
      {['REQUESTED','REVIEW_REQUIRED'].includes(row.status) && !row.carrier_attempted && <details style={{marginTop:16}}><summary>Unable to cancel this shipment?</summary><label>Customer-visible rejection reason<input value={rejectReasons[row.sale_id]||''} onChange={e=>setRejectReasons(prev=>({...prev,[row.sale_id]:e.target.value}))} /></label><button disabled={!!busy||(rejectReasons[row.sale_id]||'').trim().length<5} onClick={()=>act(row.sale_id,'reject',{reason:rejectReasons[row.sale_id]})}>Reject request and resume order processing</button></details>}
      {row.status === 'COMPLETED' && row.refund_status === 'PENDING_REFUND' && <div className="v1-operations-refund"><p>Send exactly <strong>{rupees(row.refund_amount_paise)}</strong> from Razorpay or, for collected COD, bank/UPI. Enter the processed reference below. Online refunds are verified with Razorpay.</p><label>Refund / transfer reference<input value={refs[row.sale_id] || ''} onChange={e => setRefs(prev => ({ ...prev, [row.sale_id]: e.target.value }))} /></label>{row.payment_method === 'COD' && <label className="v1-operations-check"><input type="checkbox" checked={!!confirmed[row.sale_id]} onChange={e => setConfirmed(prev => ({ ...prev, [row.sale_id]: e.target.checked }))} />I sent the exact product-only refund to the customer.</label>}<button disabled={!!busy || !(refs[row.sale_id] || '').trim() || row.payment_method === 'COD' && !confirmed[row.sale_id]} onClick={() => act(row.sale_id, 'refund-complete', { amount_paise: Number(row.refund_amount_paise), reference: refs[row.sale_id], transfer_confirmed: !!confirmed[row.sale_id] })}>Verify and record refund</button></div>}
      {row.refund_reference && <p>Refund reference: {row.refund_reference}</p>}
    </article>)}<p>Showing the most recent 200 requests.</p></main></>
}
