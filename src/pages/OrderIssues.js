import React, { useEffect, useMemo, useState } from 'react'
import './OrderIssues.css'
import Navbar from './NavbarAdmin'
import OrderCancelPopup from './OrderCancelPopup'
import { useNavigate } from 'react-router-dom'

const DEFAULT_API_BASE = 'https://taras-kart-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')

function statusText(s) {
  return String(s || '').toUpperCase()
}

function getPayable(s) {
  if (s && s.totals && s.totals.payable != null) return Number(s.totals.payable)
  if (s && s.total != null) return Number(s.total)
  if (Array.isArray(s?.items) && s.items.length) {
    return s.items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0)
  }
  return 0
}

function getCustomerLabel(s) {
  const name = s?.customer_name && String(s.customer_name).trim()
  if (name) return name
  if (s?.branch_id) return `Branch #${s.branch_id}`
  return '-'
}

function getPaymentType(s) {
  const raw = statusText(s?.payment_status || 'COD')
  if (raw.includes('COD')) return 'COD'
  if (raw.includes('PREPAID') || raw.includes('ONLINE') || raw.includes('PAID')) return 'PREPAID'
  return 'OTHER'
}

function fmtAmount(n) {
  return `₹${Number(n || 0).toFixed(2)}`
}

function refundStatusLabel(r) {
  const ref = statusText(r.refund_status || '')
  const st = statusText(r.status || '')
  if (ref === 'REFUNDED') return 'Refund completed'
  if (ref === 'PENDING_REFUND') return 'Refund approved'
  if (st === 'REQUESTED') return 'Pending review'
  if (st === 'APPROVED') return 'Approved'
  if (st === 'REJECTED') return 'Rejected'
  return ref || st || '-'
}

export default function OrderIssues() {
  const navigate = useNavigate()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('cancellations')
  const [q, setQ] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupSale, setPopupSale] = useState(null)
  const [popupSubmitting, setPopupSubmitting] = useState(false)
  const [cancelBusyId, setCancelBusyId] = useState(null)

  const [returnsLoading, setReturnsLoading] = useState(false)
  const [returnsError, setReturnsError] = useState('')
  const [returnsList, setReturnsList] = useState([])
  const [returnsLoaded, setReturnsLoaded] = useState(false)

  const [refundsLoading, setRefundsLoading] = useState(false)
  const [refundsError, setRefundsError] = useState('')
  const [refundsList, setRefundsList] = useState([])
  const [refundsLoaded, setRefundsLoaded] = useState(false)

  const fetchSales = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sales/web`)
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
  }, [])

  const cancelledOrders = useMemo(
    () => sales.filter(s => statusText(s.status) === 'CANCELLED'),
    [sales]
  )

  const filteredOrders = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return sales.filter(s => {
      const payType = getPaymentType(s)
      const okPayment = paymentFilter === 'ALL' ? true : payType === paymentFilter
      const hay = [
        s.id,
        getCustomerLabel(s),
        s.customer_email,
        s.customer_mobile,
        s.status,
        s.payment_status
      ]
        .join(' ')
        .toLowerCase()
      const okQ = ql ? hay.includes(ql) : true
      return okPayment && okQ
    })
  }, [sales, paymentFilter, q])

  const summary = useMemo(() => {
    const total = cancelledOrders.length
    const cod = cancelledOrders.filter(s => getPaymentType(s) === 'COD').length
    const prepaid = cancelledOrders.filter(s => getPaymentType(s) === 'PREPAID').length
    const totalAmount = cancelledOrders.reduce((acc, s) => acc + getPayable(s), 0)
    return { total, cod, prepaid, totalAmount }
  }, [cancelledOrders])

  const openCancelPopupForSale = sale => {
    if (!sale) return
    setPopupSale(sale)
    setPopupOpen(true)
  }

  const closeCancelPopup = () => {
    setPopupOpen(false)
    setPopupSale(null)
    setPopupSubmitting(false)
    setCancelBusyId(null)
  }

  const handleAdminConfirmCancel = async reasonText => {
    if (!popupSale) return
    setPopupSubmitting(true)
    setCancelBusyId(popupSale.id)
    const payType = getPaymentType(popupSale)
    try {
      await fetch(`${API_BASE}/api/orders/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: popupSale.id,
          payment_type: payType,
          reason: reasonText,
          source: 'admin'
        })
      })
      const trimmedReason = reasonText && reasonText.trim() ? reasonText.trim() : ''
      const nowIso = new Date().toISOString()
      setSales(prev =>
        prev.map(s =>
          s.id === popupSale.id
            ? {
                ...s,
                status: 'CANCELLED',
                updated_at: nowIso,
                cancellation_source: 'admin',
                cancellation_reason: trimmedReason || s.cancellation_reason,
                cancellation_created_at: nowIso
              }
            : s
        )
      )
      closeCancelPopup()
    } catch {
      setPopupSubmitting(false)
      setCancelBusyId(null)
    }
  }

  const fetchReturns = async () => {
    setReturnsLoading(true)
    setReturnsError('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/admin`)
      if (!res.ok) throw new Error('Unable to load returns')
      const data = await res.json()
      setReturnsList(Array.isArray(data.rows || data) ? data.rows || data : [])
      setReturnsLoaded(true)
    } catch (e) {
      setReturnsError(e.message || 'Could not load returns')
      setReturnsList([])
    } finally {
      setReturnsLoading(false)
    }
  }

  const fetchRefunds = async () => {
    setRefundsLoading(true)
    setRefundsError('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/admin/refunds`)
      if (!res.ok) throw new Error('Unable to load refunds')
      const data = await res.json()
      setRefundsList(Array.isArray(data.rows || data) ? data.rows || data : [])
      setRefundsLoaded(true)
    } catch (e) {
      setRefundsError(e.message || 'Could not load refunds')
      setRefundsList([])
    } finally {
      setRefundsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'returns' && !returnsLoaded && !returnsLoading) {
      fetchReturns()
    }
    if (activeTab === 'refunds' && !refundsLoaded && !refundsLoading) {
      fetchRefunds()
    }
  }, [activeTab, returnsLoaded, returnsLoading, refundsLoaded, refundsLoading])

  return (
    <div className="oi-screen">
      <Navbar />
      <div className="oi-layout">
        <header className="oi-header">
          <div className="oi-header-main">
            <h1 className="oi-title">Cancel / Return / Refund Center</h1>
            <p className="oi-subtitle">
              See all order problems in one place and keep customers informed.
            </p>
          </div>
          <div className="oi-header-actions">
            <button className="oi-refresh-btn" onClick={fetchSales}>
              <span className="oi-refresh-dot" />
              <span>Refresh data</span>
            </button>
          </div>
        </header>

        <div className="oi-tabs">
          <button
            className={`oi-tab ${activeTab === 'cancellations' ? 'oi-tab-active' : ''}`}
            onClick={() => setActiveTab('cancellations')}
          >
            Cancellations
          </button>
          <button
            className={`oi-tab ${activeTab === 'returns' ? 'oi-tab-active' : ''}`}
            onClick={() => setActiveTab('returns')}
          >
            Returns
          </button>
          <button
            className={`oi-tab ${activeTab === 'refunds' ? 'oi-tab-active' : ''}`}
            onClick={() => setActiveTab('refunds')}
          >
            Refunds
          </button>
        </div>

        {activeTab === 'cancellations' && (
          <>
            <section className="oi-summary">
              <div className="oi-summary-card">
                <div className="oi-summary-label">Cancelled orders</div>
                <div className="oi-summary-value">{summary.total}</div>
                <div className="oi-summary-note">Across all payment types</div>
              </div>
              <div className="oi-summary-card">
                <div className="oi-summary-label">COD cancellations</div>
                <div className="oi-summary-value">{summary.cod}</div>
                <div className="oi-summary-note">Useful for courier follow up</div>
              </div>
              <div className="oi-summary-card">
                <div className="oi-summary-label">Prepaid cancellations</div>
                <div className="oi-summary-value">{summary.prepaid}</div>
                <div className="oi-summary-note">Needs refund handling</div>
              </div>
              <div className="oi-summary-card">
                <div className="oi-summary-label">Cancelled order value</div>
                <div className="oi-summary-value">{fmtAmount(summary.totalAmount)}</div>
                <div className="oi-summary-note">Total of cancelled orders</div>
              </div>
            </section>

            <section className="oi-filters">
              <div className="oi-filter-group">
                <label className="oi-filter-label">Payment type</label>
                <select
                  className="oi-filter-select"
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="COD">COD</option>
                  <option value="PREPAID">Prepaid</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="oi-filter-group oi-filter-search">
                <label className="oi-filter-label">Search</label>
                <div className="oi-filter-search-wrap">
                  <span className="oi-filter-search-icon" />
                  <input
                    className="oi-filter-input"
                    placeholder="Search by order id, name, email or mobile"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                  />
                </div>
              </div>
              <div className="oi-filter-helper">
                Use this view to see cancelled orders, who cancelled them, and cancel new orders
                when needed.
              </div>
            </section>

            <section className="oi-table-card">
              {loading ? (
                <div className="oi-loader">
                  <div className="oi-spinner" />
                  <span className="oi-loader-text">Loading orders</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="oi-empty">
                  <div className="oi-empty-icon" />
                  <h3 className="oi-empty-title">No orders found</h3>
                  <p className="oi-empty-text">
                    When an order is cancelled, it will show up here with who cancelled and the
                    reason.
                  </p>
                </div>
              ) : (
                <div className="oi-table-scroller">
                  <table className="oi-table">
                    <thead>
                      <tr>
                        <th className="oi-th">Order</th>
                        <th className="oi-th">Placed on</th>
                        <th className="oi-th">Status</th>
                        <th className="oi-th">Payment</th>
                        <th className="oi-th">Customer</th>
                        <th className="oi-th">Mobile</th>
                        <th className="oi-th">Email</th>
                        <th className="oi-th">Amount</th>
                        <th className="oi-th">Cancel / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(s => {
                        const payType = getPaymentType(s)
                        const orderStatus = statusText(s.status)
                        const isCancelled = orderStatus === 'CANCELLED'
                        const cancelledAt =
                          s.cancellation_created_at || s.updated_at || s.created_at
                        const cancelledTime = cancelledAt
                          ? new Date(cancelledAt).toLocaleString()
                          : '-'
                        const reason =
                          s.cancellation_reason ||
                          s.cancellation_notes ||
                          s.cancellation_comment ||
                          ''
                        const originRaw = s.cancellation_source || s.cancelled_by || ''
                        const originLower = String(originRaw || '').toLowerCase()
                        let originLabel = 'Cancelled'
                        if (isCancelled) {
                          if (originLower.includes('admin')) {
                            originLabel = 'Cancelled by you'
                          } else if (
                            originLower.includes('user') ||
                            originLower.includes('customer') ||
                            originLower.includes('web')
                          ) {
                            originLabel = 'Cancelled by the user'
                          } else if (
                            originLower.includes('system') ||
                            originLower.includes('auto')
                          ) {
                            originLabel = 'Cancelled automatically'
                          } else if (!originLower) {
                            originLabel = 'Cancelled'
                          } else {
                            originLabel = `Cancelled (${originRaw})`
                          }
                        }
                        const isBusy = cancelBusyId === s.id && popupSubmitting
                        const canCancelNow =
                          !isCancelled &&
                          !orderStatus.includes('DELIVERED') &&
                          !orderStatus.includes('RTO')
                        return (
                          <tr key={s.id} className="oi-tr">
                            <td className="oi-td">
                              <span className="oi-pill-id">#{s.id}</span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-muted">
                                {s.created_at ? new Date(s.created_at).toLocaleString() : '-'}
                              </span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-status-text">{orderStatus || '-'}</span>
                            </td>
                            <td className="oi-td">
                              <span className={`oi-chip oi-chip-${payType.toLowerCase()}`}>
                                {payType}
                              </span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-strong">{getCustomerLabel(s)}</span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-text">{s.customer_mobile || '-'}</span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-muted">{s.customer_email || '-'}</span>
                            </td>
                            <td className="oi-td">
                              <span className="oi-amount">{fmtAmount(getPayable(s))}</span>
                            </td>
                            <td className="oi-td">
                              {isCancelled ? (
                                <div className="oi-notes">
                                  <div className="oi-notes-origin">
                                    {originLabel} · {cancelledTime}
                                  </div>
                                  <div className="oi-notes-reason">
                                    {reason ? reason : 'No reason captured'}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="oi-cancel-btn"
                                  disabled={isBusy || !canCancelNow}
                                  onClick={() => openCancelPopupForSale(s)}
                                >
                                  {isBusy ? 'Cancelling…' : 'Cancel order'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'returns' && (
          <section className="oi-table-card">
            {returnsLoading ? (
              <div className="oi-loader">
                <div className="oi-spinner" />
                <span className="oi-loader-text">Loading returns</span>
              </div>
            ) : returnsError ? (
              <div className="oi-empty">
                <div className="oi-empty-icon" />
                <h3 className="oi-empty-title">Could not load returns</h3>
                <p className="oi-empty-text">{returnsError}</p>
                <button className="oi-refresh-btn" onClick={fetchReturns}>
                  <span className="oi-refresh-dot" />
                  <span>Retry</span>
                </button>
              </div>
            ) : returnsList.length === 0 ? (
              <div className="oi-empty">
                <div className="oi-empty-icon" />
                <h3 className="oi-empty-title">No return requests yet</h3>
                <p className="oi-empty-text">
                  When customers raise a return or replacement request, it will show up here.
                </p>
              </div>
            ) : (
              <div className="oi-table-scroller">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th className="oi-th">Request</th>
                      <th className="oi-th">Order</th>
                      <th className="oi-th">Created</th>
                      <th className="oi-th">Type</th>
                      <th className="oi-th">Status</th>
                      <th className="oi-th">Customer</th>
                      <th className="oi-th">Mobile</th>
                      <th className="oi-th">Email</th>
                      <th className="oi-th">Amount</th>
                      <th className="oi-th">Reason</th>
                      <th className="oi-th">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnsList.map(r => {
                      const createdAt = r.created_at ? new Date(r.created_at).toLocaleString() : '-'
                      const status = statusText(r.status || '')
                      const type = statusText(r.type || '')
                      const amount =
                        r.sale_totals && r.sale_totals.payable != null
                          ? Number(r.sale_totals.payable)
                          : r.amount || 0
                      return (
                        <tr key={r.id} className="oi-tr">
                          <td className="oi-td">
                            <span className="oi-pill-id">RR#{String(r.id).slice(0, 8)}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-pill-id">#{r.sale_id}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-muted">{createdAt}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-status-text">{type || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-status-text">{status || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-strong">{r.customer_name || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">{r.customer_mobile || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-muted">{r.customer_email || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-amount">{fmtAmount(amount)}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">
                              {r.reason || r.reason_code || 'Not specified'}
                            </span>
                          </td>
                          <td className="oi-td">
                            <button
                              className="oi-cancel-btn"
                              onClick={() => navigate(`/returns/${r.id}`)}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'refunds' && (
          <section className="oi-table-card">
            {refundsLoading ? (
              <div className="oi-loader">
                <div className="oi-spinner" />
                <span className="oi-loader-text">Loading refunds</span>
              </div>
            ) : refundsError ? (
              <div className="oi-empty">
                <div className="oi-empty-icon" />
                <h3 className="oi-empty-title">Could not load refunds</h3>
                <p className="oi-empty-text">{refundsError}</p>
                <button className="oi-refresh-btn" onClick={fetchRefunds}>
                  <span className="oi-refresh-dot" />
                  <span>Retry</span>
                </button>
              </div>
            ) : refundsList.length === 0 ? (
              <div className="oi-empty">
                <div className="oi-empty-icon" />
                <h3 className="oi-empty-title">No refunds logged yet</h3>
                <p className="oi-empty-text">
                  When refunds are initiated, they will show up here with amount and status.
                </p>
              </div>
            ) : (
              <div className="oi-table-scroller">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th className="oi-th">Refund</th>
                      <th className="oi-th">Order</th>
                      <th className="oi-th">Request</th>
                      <th className="oi-th">Amount</th>
                      <th className="oi-th">Mode</th>
                      <th className="oi-th">Status</th>
                      <th className="oi-th">Initiated by</th>
                      <th className="oi-th">Created</th>
                      <th className="oi-th">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundsList.map(r => {
                      const createdAt = r.created_at ? new Date(r.created_at).toLocaleString() : '-'
                      return (
                        <tr key={r.id} className="oi-tr">
                          <td className="oi-td">
                            <span className="oi-pill-id">RF#{String(r.id).slice(0, 8)}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-pill-id">#{r.sale_id}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">
                              {r.return_request_id ? String(r.return_request_id).slice(0, 8) : '-'}
                            </span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-amount">{fmtAmount(r.amount)}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">{r.mode || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-status-text">{refundStatusLabel(r)}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">{r.initiated_by || '-'}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-muted">{createdAt}</span>
                          </td>
                          <td className="oi-td">
                            <span className="oi-text">{r.remarks || '-'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      <OrderCancelPopup
        open={popupOpen}
        sale={popupSale}
        onClose={closeCancelPopup}
        onConfirm={handleAdminConfirmCancel}
        isSubmitting={popupSubmitting}
      />
    </div>
  )
}
