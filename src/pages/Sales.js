import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './Sales.css'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'
import OrderDetailPopup from './OrderDetailPopup'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')
const STATUSES = ['ALL', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'CANCELLED']
const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']
const PAYMENT_FILTERS = ['ALL', 'COD', 'PREPAID', 'PENDING', 'FAILED']
const STAGE_FILTERS = ['ALL', 'COMPLETE', 'INCOMPLETE']

function statusText(s) {
  return String(s || '').toUpperCase()
}

function computeStepFromLocal(orderStatus) {
  const idx = ORDER_STEPS.indexOf(orderStatus || 'PLACED')
  if (idx === -1) return 0
  return idx
}

function computeStepFromShiprocket(srStatus) {
  const s = statusText(srStatus)
  if (!s) return 0
  if (s.includes('DELIVERED')) return 4
  if (s.includes('OUT FOR DELIVERY') || s.includes('OUT_FOR_DELIVERY')) return 3
  if (s.includes('IN TRANSIT') || s.includes('DISPATCH') || s.includes('SHIPPED') || s.includes('PICKED')) return 3
  if (s.includes('AWB') || s.includes('PACKED') || s.includes('MANIFEST')) return 2
  if (s.includes('CONFIRMED') || s.includes('PROCESSING') || s.includes('ACCEPTED') || s.includes('CREATED')) return 1
  return 0
}

function computeStepFromShipment(sh, srCore) {
  if (!sh && !srCore) return 0
  const s = statusText(sh?.status || '')
  const sr = statusText(srCore?.current_status || '')
  const combined = `${s} ${sr}`.trim()
  if (!combined) {
    if (sh && sh.awb) return 2
    return 1
  }
  if (combined.includes('DELIVERED')) return 4
  if (combined.includes('OUT FOR DELIVERY') || combined.includes('OUT_FOR_DELIVERY')) return 3
  if (combined.includes('IN TRANSIT') || combined.includes('DISPATCH') || combined.includes('SHIPPED') || combined.includes('PICKED')) return 3
  if (combined.includes('PACKED') || combined.includes('MANIFEST')) return 2
  if (combined.includes('CONFIRMED') || combined.includes('PROCESSING') || combined.includes('ACCEPTED') || combined.includes('CREATED')) return 1
  return 0
}

function extractTrackingCore(raw) {
  if (!raw) return null
  let core = raw
  if (Array.isArray(core) && core.length) {
    const first = core[0]
    if (first && typeof first === 'object') {
      const key = Object.keys(first)[0]
      if (key && first[key] && first[key].tracking_data) {
        core = first[key].tracking_data
      }
    }
  } else if (core.tracking_data) {
    core = core.tracking_data
  }
  if (!core || typeof core !== 'object') return null
  return core
}

function buildTrackingSnapshot(raw) {
  const core = extractTrackingCore(raw)
  if (!core) {
    return {
      status: '',
      eddText: null,
      lastEventText: null,
      core: null
    }
  }
  const tracks = Array.isArray(core.shipment_track) ? core.shipment_track : []
  const lastTrack = tracks.length ? tracks[tracks.length - 1] : null
  const status = (lastTrack && lastTrack.current_status) || core.current_status || core.status || ''
  const eddRaw = (lastTrack && lastTrack.edd) || core.edd || null
  const lastEventRaw =
    (lastTrack && (lastTrack.date || lastTrack.pickup_date || lastTrack.updated_time_stamp)) ||
    core.updated_time_stamp ||
    core.last_status_time ||
    null
  const edd = eddRaw ? new Date(eddRaw) : null
  const lastEvent = lastEventRaw ? new Date(lastEventRaw) : null
  return {
    status,
    eddText:
      edd && !Number.isNaN(edd.getTime())
        ? edd.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' })
        : null,
    lastEventText: lastEvent && !Number.isNaN(lastEvent.getTime()) ? lastEvent.toLocaleString('en-IN') : null,
    core
  }
}

function buildExpectedDeliveryText(trackingSnapshot, sale, latestShipment) {
  if (trackingSnapshot && trackingSnapshot.eddText) return trackingSnapshot.eddText
  const baseRaw =
    (latestShipment && (latestShipment.pickup_date || latestShipment.created_at)) ||
    (sale && (sale.updated_at || sale.created_at)) ||
    null
  if (!baseRaw) return '-'
  const base = new Date(baseRaw)
  if (Number.isNaN(base.getTime())) return '-'
  base.setDate(base.getDate() + 5)
  return base.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  })
}

function normalizePayMode(paymentStatus) {
  const p = statusText(paymentStatus)
  if (!p) return 'UNKNOWN'
  if (p.includes('COD') || p.includes('CASH')) return 'COD'
  if (p.includes('PREPAID') || p.includes('PAID') || p.includes('ONLINE') || p.includes('RAZORPAY') || p.includes('PAYMENT_SUCCESS')) return 'PREPAID'
  if (p.includes('PENDING') || p.includes('INIT') || p.includes('CREATED') || p.includes('PROCESSING')) return 'PENDING'
  if (p.includes('FAILED') || p.includes('CANCEL')) return 'FAILED'
  return p
}

function normalizeOrderStage(saleStatus) {
  const st = statusText(saleStatus)
  if (!st) return 'UNKNOWN'
  if (st.includes('CANCEL')) return 'CANCELLED'
  if (st.includes('DELIVER')) return 'DELIVERED'
  if (st.includes('SHIP')) return 'SHIPPED'
  if (st.includes('PACK')) return 'PACKED'
  if (st.includes('CONFIRM')) return 'CONFIRMED'
  if (st.includes('PLACE')) return 'PLACED'
  return st
}

function isIncompleteOrder(s) {
  const stage = normalizeOrderStage(s?.status)
  const pay = normalizePayMode(s?.payment_status)
  const payable = Number(s && s.totals && s.totals.payable != null ? s.totals.payable : s && s.total != null ? s.total : 0)
  const hasCustomer =
    (s?.customer_name && String(s.customer_name).trim()) ||
    (s?.customer_email && String(s.customer_email).trim()) ||
    (s?.customer_mobile && String(s.customer_mobile).trim())
  const hasItems = Array.isArray(s?.items) ? s.items.length > 0 : true
  const missingTotal = !Number.isFinite(payable) || payable <= 0
  const badStage = stage === 'UNKNOWN'
  const badPay = pay === 'UNKNOWN'
  return !hasCustomer || !hasItems || missingTotal || badStage || badPay
}

export default function Sales() {
  const { token } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const getPayable = useCallback((s) => {
    if (s && s.totals && s.totals.payable != null) return Number(s.totals.payable)
    if (s && s.total != null) return Number(s.total)
    if (Array.isArray(s?.items) && s.items.length) {
      return s.items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0)
    }
    return 0
  }, [])

  const getCustomerLabel = useCallback((s) => {
    const name = s?.customer_name && String(s.customer_name).trim()
    if (name) return name
    if (s?.branch_id) return `Branch #${s.branch_id}`
    return '-'
  }, [])

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      if (!token) {
        setSales([])
        return
      }
      const res = await fetch(`${API_BASE}/api/sales/admin`, { headers: authHeaders })
      const data = await res.json().catch(() => [])
      setSales(Array.isArray(data) ? data : [])
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : null

    return sales.filter((s) => {
      const okStatus = status === 'ALL' ? true : String(s.status || '').toUpperCase() === status

      const payMode = normalizePayMode(s?.payment_status)
      const okPayment = paymentFilter === 'ALL' ? true : payMode === paymentFilter

      const incomplete = isIncompleteOrder(s)
      const okStage = stageFilter === 'ALL' ? true : stageFilter === 'INCOMPLETE' ? incomplete : !incomplete

      const created = s.created_at ? new Date(s.created_at).getTime() : null
      const okFrom = fromTs ? (created ? created >= fromTs : true) : true
      const okTo = toTs ? (created ? created <= toTs : true) : true

      const t = s.totals || {}
      const hay = [s.id, getCustomerLabel(s), s.customer_email, s.customer_mobile, s.status, s.payment_status, t?.payable, getPayable(s)]
        .join(' ')
        .toLowerCase()

      const okQ = ql ? hay.includes(ql) : true
      return okStatus && okPayment && okStage && okFrom && okTo && okQ
    })
  }, [sales, status, paymentFilter, stageFilter, q, from, to, getCustomerLabel, getPayable])

  const grand = useMemo(() => {
    return filtered.reduce((acc, s) => acc + getPayable(s), 0)
  }, [filtered, getPayable])

  const statusCounts = useMemo(() => {
    return {
      total: sales.length,
      placed: sales.filter((s) => statusText(s.status) === 'PLACED').length,
      confirmed: sales.filter((s) => statusText(s.status) === 'CONFIRMED').length,
      shipped: sales.filter((s) => statusText(s.status) === 'SHIPPED').length,
      cancelled: sales.filter((s) => statusText(s.status) === 'CANCELLED').length
    }
  }, [sales])

  const openDetail = useCallback(
    async (id) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const [saleRes, shRes] = await Promise.all([
          fetch(`${API_BASE}/api/sales/admin/${id}`, { headers: authHeaders }),
          fetch(`${API_BASE}/api/shipments/by-sale/${id}`, { headers: authHeaders })
        ])

        const saleJson = await saleRes.json().catch(() => null)
        const shJson = await shRes.json().catch(() => [])
        const sale = saleJson && saleJson.sale ? saleJson.sale : saleJson
        const items = Array.isArray(saleJson?.items) ? saleJson.items : []
        const shipments = Array.isArray(shJson) ? shJson : []
        const latestShipment = shipments.length ? shipments[shipments.length - 1] : null

        let trackingRaw = null
        const trackOrderId = latestShipment?.shiprocket_order_id || latestShipment?.awb || ''
        if (trackOrderId) {
          try {
            const trRes = await fetch(`${API_BASE}/api/shiprocket/track/${encodeURIComponent(trackOrderId)}`)
            const trJson = await trRes.json().catch(() => null)
            if (trRes.ok && trJson) trackingRaw = trJson
          } catch {
            trackingRaw = null
          }
        }

        const trackingSnapshot = buildTrackingSnapshot(trackingRaw)

        setDetail({
          sale,
          items,
          shipments,
          trackingSnapshot,
          latestShipment
        })
      } catch {
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [authHeaders]
  )

  const fmt = useCallback((n) => `₹${Number(n || 0).toFixed(2)}`, [])

  return (
    <div className="sales-page">
      <Navbar />

      <div className="sales-shell">
        <div className="sales-hero">
          <div className="sales-hero-main">
            <div className="sales-kicker">Order Management</div>
            <h1 className="sales-title">Sales Dashboard</h1>
            <p className="sales-subtitle">Review recent orders, track payment status, and open complete order details from one clean dashboard.</p>
          </div>
          <div className="sales-hero-actions">
            <button className="sales-refresh-btn" onClick={fetchSales}>
              <span className="sales-refresh-icon" />
              <span>{loading ? 'Refreshing...' : 'Refresh list'}</span>
            </button>
          </div>
        </div>

        <div className="sales-stats-grid">
          <div className="sales-stat-card">
            <span className="sales-stat-label">Total Orders</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.total}</span>
          </div>
          <div className="sales-stat-card soft-blue">
            <span className="sales-stat-label">Placed</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.placed}</span>
          </div>
          <div className="sales-stat-card soft-green">
            <span className="sales-stat-label">Confirmed</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.confirmed}</span>
          </div>
          <div className="sales-stat-card soft-gold">
            <span className="sales-stat-label">Shipped</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.shipped}</span>
          </div>
          <div className="sales-stat-card soft-red">
            <span className="sales-stat-label">Cancelled</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.cancelled}</span>
          </div>
        </div>

        <div className="sales-filters-card">
          <div className="sales-section-top">
            <div>
              <h2 className="sales-section-title">Filters</h2>
              <p className="sales-section-subtitle">Quickly narrow down orders using status, payment, date, or customer information.</p>
            </div>
          </div>

          <div className="sales-filters-grid">
            <div className="sales-filter-group">
              <label className="sales-filter-label">Status</label>
              <select className="sales-filter-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="sales-filter-group">
              <label className="sales-filter-label">Payment</label>
              <select className="sales-filter-control" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                {PAYMENT_FILTERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="sales-filter-group">
              <label className="sales-filter-label">Completeness</label>
              <select className="sales-filter-control" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                {STAGE_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="sales-filter-group sales-filter-group-wide">
              <label className="sales-filter-label">Search</label>
              <div className="sales-search-wrap">
                <span className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Search by order id, name, email or mobile"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="sales-filter-group">
              <label className="sales-filter-label">From</label>
              <input className="sales-filter-control" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div className="sales-filter-group">
              <label className="sales-filter-label">To</label>
              <input className="sales-filter-control" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="sales-summary-bar">
          <div className="sales-summary-item">
            <span className="sales-summary-label">Visible Orders</span>
            <span className="sales-summary-value">{loading ? 'Loading...' : `${filtered.length} order${filtered.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="sales-summary-item">
            <span className="sales-summary-label">Total Payable</span>
            <span className="sales-summary-value highlight">{fmt(grand)}</span>
          </div>
        </div>

        <div className="sales-table-card">
          {loading ? (
            <div className="sales-loader">
              <div className="sales-spinner" />
              <span className="sales-loader-text">Fetching latest orders</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sales-empty-state">
              <div className="sales-empty-graphic" />
              <h3 className="sales-empty-title">No orders found</h3>
              <p className="sales-empty-text">Try changing the filters or clearing your search to view more results.</p>
            </div>
          ) : (
            <div className="sales-table-scroller">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Placed at</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th className="align-right">Payable</th>
                    <th className="align-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const localStatus = statusText(s.status || 'PLACED')
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="sales-order-id">#{s.id}</span>
                        </td>
                        <td>
                          <span className="sales-text-soft">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</span>
                        </td>
                        <td>
                          <span className={`sales-status-pill sales-status-${String(s.status || '').toLowerCase()}`}>{localStatus || '-'}</span>
                        </td>
                        <td>
                          <span className="sales-payment-pill">{String(s.payment_status || 'COD').toUpperCase()}</span>
                        </td>
                        <td>
                          <span className="sales-text-main">{getCustomerLabel(s)}</span>
                        </td>
                        <td>
                          <span className="sales-text-main">{s.customer_mobile || '-'}</span>
                        </td>
                        <td>
                          <span className="sales-text-soft">{s.customer_email || '-'}</span>
                        </td>
                        <td className="align-right">
                          <span className="sales-amount">{fmt(getPayable(s))}</span>
                        </td>
                        <td className="align-right">
                          <button className="sales-action-btn" onClick={() => openDetail(s.id)}>
                            View details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <OrderDetailPopup
        open={detailLoading || !!detail}
        loading={detailLoading}
        detail={detail}
        onClose={() => setDetail(null)}
        apiBase={API_BASE}
        orderSteps={ORDER_STEPS}
        statusText={statusText}
        computeStepFromLocal={computeStepFromLocal}
        computeStepFromShiprocket={computeStepFromShiprocket}
        computeStepFromShipment={computeStepFromShipment}
        buildExpectedDeliveryText={buildExpectedDeliveryText}
        fmt={fmt}
      />
    </div>
  )
}