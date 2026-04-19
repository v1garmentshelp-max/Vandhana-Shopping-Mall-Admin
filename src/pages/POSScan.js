import React, { useEffect, useMemo, useState } from 'react'
import Navbar from './NavbarAdmin'
import BarcodeScanner from './BarcodeScanner'
import useOfflineQueue from './useOfflineQueue'
import { apiGet, apiPost } from './api'
import { useAuth } from './AdminAuth'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function POSScan() {
  const { user } = useAuth()
  const [branchId, setBranchId] = useState('')
  const [saleId, setSaleId] = useState(localStorage.getItem('pos_sale_id') || uuid())
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState({ method: 'cash', amount: '', ref: '' })
  const { queue, enqueue } = useOfflineQueue()

  useEffect(() => {
    const b = String(user?.branch_id || localStorage.getItem('pos_branch_id') || '').trim()
    setBranchId(b)
    if (b) localStorage.setItem('pos_branch_id', b)
  }, [user?.branch_id])

  const total = useMemo(() => lines.reduce((a, b) => a + (Number(b.price) || 0) * (Number(b.qty) || 1), 0), [lines])

  const addOrIncrement = (line) => {
    setLines((prev) => {
      const idx = prev.findIndex((x) => x.productId === line.productId && x.barcode === line.barcode)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: (copy[idx].qty || 1) + 1 }
        return copy
      }
      return [...prev, { ...line, qty: 1 }]
    })
  }

  async function lookupBarcode(barcode) {
    setStatus('Looking up...')
    try {
      const p = await apiGet(`/api/barcodes/${encodeURIComponent(barcode)}`).catch(() => null)
      if (!p) {
        setStatus(`No match: ${barcode}`)
        return
      }
      const price = Number(p.retail_price ?? p.final_price_b2c ?? p.final_price ?? 0)
      addOrIncrement({
        id: uuid(),
        productId: p.id || p.variant_id || p.product_id || 0,
        name: p.product_name || p.name || 'Product',
        price: price,
        barcode
      })
      const actionId = uuid()
      const payload = {
        branch_id: branchId || user?.branch_id,
        ean_code: barcode,
        qty: 1,
        sale_id: saleId,
        client_action_id: actionId
      }
      try {
        await apiPost('/api/inventory/scan', payload)
      } catch {
        enqueue({ id: actionId, url: '/api/inventory/scan', method: 'POST', body: payload })
      }
      setStatus('Added')
    } catch {
      setStatus('Lookup failed')
    } finally {
      setTimeout(() => setStatus(''), 1000)
    }
  }

  const changeQty = (lineId, delta) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, qty: Math.max(1, (l.qty || 1) + delta) } : l)))
  }
  const removeLine = (lineId) => setLines((prev) => prev.filter((l) => l.id !== lineId))

  const startNewSale = () => {
    const id = uuid()
    setSaleId(id)
    localStorage.setItem('pos_sale_id', id)
    setLines([])
  }

  async function confirmSale() {
    if (!lines.length) return
    const actionId = uuid()
    const payload = {
      sale_id: saleId,
      branch_id: branchId || user?.branch_id,
      payment: { ...payment, amount: Number(payment.amount) || total },
      items: lines.map((l) => ({ variant_id: l.productId, qty: l.qty, ean_code: l.barcode, price: l.price })),
      client_action_id: actionId
    }
    try {
      await apiPost('/api/sales/confirm', payload)
      setStatus('Sale confirmed')
      startNewSale()
    } catch {
      enqueue({ id: actionId, url: '/api/sales/confirm', method: 'POST', body: payload })
      setStatus('Queued (offline)')
      startNewSale()
    } finally {
      setTimeout(() => setStatus(''), 1500)
    }
  }

  return (
    <div className="pos-scan-page">
      <Navbar />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
        <h2>Branch POS</h2>
        <p style={{ opacity: 0.8, marginTop: -6 }}>Scan items, then confirm after payment.</p>

        <div className="pos-top" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
          <div className="card" style={{ padding: 12 }}>
            <label>Branch</label>
            <div style={{ marginTop: 6, fontWeight: 600 }}>{branchId || '—'}</div>
            <div style={{ marginTop: 12 }}>
              <label>Sale ID</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={saleId} readOnly />
                <button onClick={startNewSale}>New Sale</button>
              </div>
              <small style={{ opacity: 0.7 }}>Queued actions: {queue.length}</small>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <label>Scan / Enter Barcode</label>
            <BarcodeScanner onDetected={lookupBarcode} />
            {status && <div style={{ marginTop: 8, color: '#ffd84d' }}>{status}</div>}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3>Items</h3>
          <table style={{ width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.barcode}</td>
                  <td>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => changeQty(l.id, -1)}>-</button>
                      <span>{l.qty}</span>
                      <button onClick={() => changeQty(l.id, +1)}>+</button>
                    </div>
                  </td>
                  <td>₹{Number(l.price || 0).toFixed(0)}</td>
                  <td>₹{(Number(l.price || 0) * (l.qty || 1)).toFixed(0)}</td>
                  <td><button onClick={() => removeLine(l.id)}>Remove</button></td>
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td colSpan="6" style={{ padding: 12, color: '#999' }}>No items yet. Scan a barcode.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, opacity: 0.7 }}>Total</div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>₹{total.toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3>Payment & Confirm</h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            <select value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
            <input
              type="number"
              placeholder="Amount (optional)"
              value={payment.amount}
              onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Ref / UTR (optional)"
              value={payment.ref}
              onChange={(e) => setPayment((p) => ({ ...p, ref: e.target.value }))}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button disabled={!branchId || !lines.length} onClick={confirmSale}>Confirm Sale</button>
            {!branchId && <small style={{ marginLeft: 8, color: '#f77' }}>Select branch</small>}
          </div>
        </div>
      </div>
    </div>
  )
}
