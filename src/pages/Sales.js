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

const STATUSES = ['ALL', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']
const PAYMENT_FILTERS = ['ALL', 'COD', 'PREPAID', 'PENDING', 'FAILED']
const STAGE_FILTERS = ['ALL', 'COMPLETE', 'INCOMPLETE']

function toArray(x) {
  if (Array.isArray(x)) return x
  if (Array.isArray(x?.data)) return x.data
  if (Array.isArray(x?.rows)) return x.rows
  if (Array.isArray(x?.items)) return x.items
  if (Array.isArray(x?.shipments)) return x.shipments
  if (Array.isArray(x?.result)) return x.result
  return []
}

function parseMaybeJson(value) {
  if (!value) return value
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function statusText(s) {
  return String(s || '').trim().toUpperCase()
}

function stageFromText(value) {
  const s = statusText(value)

  if (!s) return ''
  if (s.includes('CANCEL')) return 'CANCELLED'
  if (s.includes('DELIVERED') || s.includes('DELIVERED TO') || s.includes('DELIVER')) return 'DELIVERED'
  if (s.includes('OUT FOR DELIVERY') || s.includes('OUT_FOR_DELIVERY')) return 'SHIPPED'
  if (s.includes('IN TRANSIT') || s.includes('TRANSIT') || s.includes('DISPATCH') || s.includes('DISPATCHED') || s.includes('SHIPPED') || s.includes('PICKED') || s.includes('PICKUP')) return 'SHIPPED'
  if (s.includes('PACKED') || s.includes('MANIFEST') || s.includes('AWB') || s.includes('READY TO SHIP') || s.includes('READY_TO_SHIP')) return 'PACKED'
  if (s.includes('CONFIRMED') || s.includes('PROCESSING') || s.includes('ACCEPTED') || s.includes('CREATED')) return 'CONFIRMED'
  if (s.includes('PLACED') || s.includes('NEW')) return 'PLACED'

  return s
}

function statusRank(stage) {
  const s = stageFromText(stage)
  if (s === 'PLACED') return 0
  if (s === 'CONFIRMED') return 1
  if (s === 'PACKED') return 2
  if (s === 'SHIPPED') return 3
  if (s === 'DELIVERED') return 4
  return -1
}

function collectStatusValues(input, depth = 0, out = []) {
  if (!input || depth > 6 || out.length > 80) return out

  if (typeof input === 'string') {
    const v = input.trim()
    if (v && v.length <= 180) out.push(v)
    return out
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectStatusValues(item, depth + 1, out))
    return out
  }

  if (typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      const k = String(key || '').toLowerCase()

      if (
        k.includes('status') ||
        k.includes('activity') ||
        k.includes('remark') ||
        k.includes('description') ||
        k.includes('event')
      ) {
        if (typeof value === 'string' || typeof value === 'number') out.push(String(value))
        else collectStatusValues(value, depth + 1, out)
      } else if (typeof value === 'object') {
        collectStatusValues(value, depth + 1, out)
      }
    })
  }

  return out
}

function bestStageFromValues(values, fallback = 'PLACED') {
  const list = Array.isArray(values) ? values : [values]
  let best = stageFromText(fallback) || 'PLACED'
  let bestRank = statusRank(best)

  list.forEach((value) => {
    const stage = stageFromText(value)
    const rank = statusRank(stage)

    if (stage === 'CANCELLED') {
      best = 'CANCELLED'
      bestRank = 99
      return
    }

    if (rank > bestRank) {
      best = stage
      bestRank = rank
    }
  })

  return best
}

function getLatestShipment(shipments) {
  const list = toArray(shipments)
  if (!list.length) return null

  return [...list].sort((a, b) => {
    const at = new Date(a?.updated_at || a?.created_at || 0).getTime()
    const bt = new Date(b?.updated_at || b?.created_at || 0).getTime()
    return bt - at
  })[0]
}

function extractTrackingCore(raw) {
  if (!raw) return null

  let core = raw

  if (Array.isArray(core) && core.length) {
    const first = core[0]
    if (first && typeof first === 'object') {
      const key = Object.keys(first)[0]
      if (key && first[key]?.tracking_data) core = first[key].tracking_data
      else core = first
    }
  }

  if (core?.tracking_data) core = core.tracking_data
  else if (core?.data?.tracking_data) core = core.data.tracking_data
  else if (core?.data?.data?.tracking_data) core = core.data.data.tracking_data
  else if (core?.data) core = core.data

  if (!core || typeof core !== 'object') return null
  return core
}

function buildTrackingSnapshot(raw) {
  const core = extractTrackingCore(raw)

  if (!core) {
    return {
      status: '',
      statuses: [],
      eddText: null,
      lastEventText: null,
      core: null
    }
  }

  const tracks = Array.isArray(core.shipment_track) ? core.shipment_track : []
  const activities = Array.isArray(core.shipment_track_activities) ? core.shipment_track_activities : []
  const lastTrack = tracks.length ? tracks[tracks.length - 1] : null
  const lastActivity = activities.length ? activities[0] : null

  const statuses = collectStatusValues(core)
  const status =
    bestStageFromValues(statuses, '') ||
    lastActivity?.activity ||
    lastActivity?.status ||
    lastTrack?.current_status ||
    core.current_status ||
    core.status ||
    core.track_status ||
    ''

  const eddRaw = lastTrack?.edd || core.edd || null
  const lastEventRaw =
    lastActivity?.date ||
    lastActivity?.activity_date_time ||
    lastActivity?.updated_time_stamp ||
    lastTrack?.date ||
    lastTrack?.pickup_date ||
    lastTrack?.updated_time_stamp ||
    core.updated_time_stamp ||
    core.last_status_time ||
    core.delivered_date ||
    core.pickup_date ||
    null

  const edd = eddRaw ? new Date(eddRaw) : null
  const lastEvent = lastEventRaw ? new Date(lastEventRaw) : null

  return {
    status,
    statuses,
    eddText:
      edd && !Number.isNaN(edd.getTime())
        ? edd.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' })
        : null,
    lastEventText: lastEvent && !Number.isNaN(lastEvent.getTime()) ? lastEvent.toLocaleString('en-IN') : null,
    core
  }
}

function getEffectiveOrderStatus(sale, trackingSnapshot = null, latestShipment = null) {
  const localRaw = sale?.effective_status || sale?.status || sale?.order_status || ''
  const localStage = stageFromText(localRaw)

  if (localStage === 'CANCELLED') return 'CANCELLED'

  const candidates = [
    localStage,
    sale?.shipment_status,
    sale?.shipping_status,
    sale?.shiprocket_status,
    sale?.tracking_status,
    sale?.current_status,
    sale?.fulfillment_status,
    latestShipment?.status,
    latestShipment?.shipment_status,
    latestShipment?.current_status,
    latestShipment?.shiprocket_status,
    latestShipment?.awb ? 'PACKED' : '',
    trackingSnapshot?.status,
    trackingSnapshot?.core?.current_status,
    trackingSnapshot?.core?.status,
    ...(Array.isArray(trackingSnapshot?.statuses) ? trackingSnapshot.statuses : [])
  ].filter(Boolean)

  return bestStageFromValues(candidates, localStage || 'PLACED')
}

function computeStepFromLocal(orderStatus) {
  const stage = stageFromText(orderStatus || 'PLACED')
  const idx = ORDER_STEPS.indexOf(stage)
  return idx === -1 ? 0 : idx
}

function computeStepFromShiprocket(srStatus) {
  const stage = stageFromText(srStatus)
  const idx = ORDER_STEPS.indexOf(stage)
  return idx === -1 ? 0 : idx
}

function computeStepFromShipment(sh, srCore) {
  if (!sh && !srCore) return 0
  const stage = getEffectiveOrderStatus({}, { status: srCore?.current_status || srCore?.status, statuses: collectStatusValues(srCore), core: srCore }, sh)
  const idx = ORDER_STEPS.indexOf(stage)
  if (idx === -1) return sh?.awb ? 2 : 0
  return idx
}

function buildExpectedDeliveryText(trackingSnapshot, sale, latestShipment) {
  if (trackingSnapshot?.eddText) return trackingSnapshot.eddText

  const deliveredRaw =
    latestShipment?.delivered_at ||
    latestShipment?.delivered_date ||
    trackingSnapshot?.core?.delivered_date ||
    null

  if (deliveredRaw) {
    const delivered = new Date(deliveredRaw)
    if (!Number.isNaN(delivered.getTime())) {
      return delivered.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit'
      })
    }
  }

  const baseRaw =
    latestShipment?.pickup_date ||
    latestShipment?.created_at ||
    sale?.updated_at ||
    sale?.created_at ||
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

function isIncompleteOrder(s) {
  const stage = getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null)
  const pay = normalizePayMode(s?.payment_status || s?.payment_method)
  const totals = parseMaybeJson(s?.totals) || {}
  const payable = Number(totals.payable != null ? totals.payable : s?.total != null ? s.total : 0)

  const hasCustomer =
    (s?.customer_name && String(s.customer_name).trim()) ||
    (s?.customer_email && String(s.customer_email).trim()) ||
    (s?.customer_mobile && String(s.customer_mobile).trim())

  const hasItems = Array.isArray(s?.items) ? s.items.length > 0 : true
  const missingTotal = !Number.isFinite(payable) || payable <= 0
  const badStage = !stage || stage === 'UNKNOWN'
  const badPay = pay === 'UNKNOWN'

  return !hasCustomer || !hasItems || missingTotal || badStage || badPay
}

function displayDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN')
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

  const fmt = useCallback((n) => `₹${Number(n || 0).toFixed(2)}`, [])

  const getPayable = useCallback((s) => {
    const totals = parseMaybeJson(s?.totals) || {}

    if (totals.payable != null) return Number(totals.payable)
    if (totals.total != null) return Number(totals.total)
    if (s?.total != null) return Number(s.total)

    if (Array.isArray(s?.items) && s.items.length) {
      return s.items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || it.quantity || 0), 0)
    }

    return 0
  }, [])

  const getCustomerLabel = useCallback((s) => {
    const name = s?.customer_name && String(s.customer_name).trim()
    if (name) return name
    if (s?.customer?.name) return s.customer.name
    if (s?.branch_id) return `Branch #${s.branch_id}`
    return '-'
  }, [])

  const fetchJsonSafe = useCallback(async (url, options = {}) => {
    const res = await fetch(url, options)
    const text = await res.text().catch(() => '')
    let json = null

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    return { res, json }
  }, [])

  const enrichSalesWithShipments = useCallback(
    async (list) => {
      const chunkSize = 6
      const output = []

      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize)

        const enrichedChunk = await Promise.all(
          chunk.map(async (sale) => {
            try {
              const { res, json } = await fetchJsonSafe(`${API_BASE}/api/shipments/by-sale/${encodeURIComponent(sale.id)}`, {
                headers: authHeaders
              })

              if (!res.ok) {
                const effective = getEffectiveOrderStatus(sale)
                return { ...sale, effective_status: effective }
              }

              const shipments = toArray(json)
              const latestShipment = getLatestShipment(shipments)
              const trackingSnapshot = {
                status: latestShipment?.status || latestShipment?.current_status || '',
                statuses: collectStatusValues(latestShipment),
                core: latestShipment || null,
                eddText: null,
                lastEventText: null
              }

              const effective = getEffectiveOrderStatus(sale, trackingSnapshot, latestShipment)

              return {
                ...sale,
                shipments_summary: shipments,
                latest_shipment: latestShipment,
                trackingSnapshot,
                effective_status: effective
              }
            } catch {
              const effective = getEffectiveOrderStatus(sale)
              return { ...sale, effective_status: effective }
            }
          })
        )

        output.push(...enrichedChunk)
      }

      return output
    },
    [authHeaders, fetchJsonSafe]
  )

  const fetchSales = useCallback(async () => {
    setLoading(true)

    try {
      if (!token) {
        setSales([])
        return
      }

      const res = await fetch(`${API_BASE}/api/sales/admin`, { headers: authHeaders })
      const data = await res.json().catch(() => [])
      const baseSales = Array.isArray(data) ? data : toArray(data)

      const normalized = baseSales.map((sale) => ({
        ...sale,
        effective_status: getEffectiveOrderStatus(sale)
      }))

      setSales(normalized)

      const enriched = await enrichSalesWithShipments(normalized)
      setSales(enriched)
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders, enrichSalesWithShipments])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : null

    return sales.filter((s) => {
      const displayStatus = getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null)
      const okStatus = status === 'ALL' ? true : displayStatus === status

      const payMode = normalizePayMode(s?.payment_status || s?.payment_method)
      const okPayment = paymentFilter === 'ALL' ? true : payMode === paymentFilter

      const incomplete = isIncompleteOrder(s)
      const okStage = stageFilter === 'ALL' ? true : stageFilter === 'INCOMPLETE' ? incomplete : !incomplete

      const created = s.created_at ? new Date(s.created_at).getTime() : null
      const okFrom = fromTs ? (created ? created >= fromTs : true) : true
      const okTo = toTs ? (created ? created <= toTs : true) : true

      const totals = parseMaybeJson(s.totals) || {}
      const hay = [
        s.id,
        getCustomerLabel(s),
        s.customer_email,
        s.customer_mobile,
        displayStatus,
        s.status,
        s.payment_status,
        s.payment_method,
        totals?.payable,
        getPayable(s),
        s?.latest_shipment?.awb,
        s?.latest_shipment?.shiprocket_order_id,
        s?.latest_shipment?.shiprocket_shipment_id
      ]
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
      placed: sales.filter((s) => getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null) === 'PLACED').length,
      confirmed: sales.filter((s) => getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null) === 'CONFIRMED').length,
      shipped: sales.filter((s) => getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null) === 'SHIPPED').length,
      delivered: sales.filter((s) => getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null) === 'DELIVERED').length,
      cancelled: sales.filter((s) => getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null) === 'CANCELLED').length
    }
  }, [sales])

  const openDetail = useCallback(
    async (id) => {
      setDetailLoading(true)
      setDetail(null)

      try {
        const [saleRes, shRes] = await Promise.all([
          fetch(`${API_BASE}/api/sales/admin/${encodeURIComponent(id)}`, { headers: authHeaders }),
          fetch(`${API_BASE}/api/shipments/by-sale/${encodeURIComponent(id)}`, { headers: authHeaders })
        ])

        const saleJson = await saleRes.json().catch(() => null)
        const shJson = await shRes.json().catch(() => [])
        const saleBase = saleJson && saleJson.sale ? saleJson.sale : saleJson
        const items = Array.isArray(saleJson?.items) ? saleJson.items : Array.isArray(saleBase?.items) ? saleBase.items : []
        const shipments = toArray(shJson)
        const latestShipment = getLatestShipment(shipments)

        let trackingRaw = null

        const trackingCandidates = [
          `${API_BASE}/api/shiprocket/tracking/by-sale/${encodeURIComponent(id)}`,
          latestShipment?.shiprocket_order_id ? `${API_BASE}/api/shiprocket/track/${encodeURIComponent(latestShipment.shiprocket_order_id)}` : '',
          latestShipment?.awb ? `${API_BASE}/api/shiprocket/track/${encodeURIComponent(latestShipment.awb)}` : ''
        ].filter(Boolean)

        for (const url of trackingCandidates) {
          try {
            const { res, json } = await fetchJsonSafe(url, { headers: authHeaders })
            if (res.ok && json) {
              trackingRaw = json
              break
            }
          } catch {}
        }

        const trackingSnapshot = buildTrackingSnapshot(trackingRaw || latestShipment)
        const effectiveStatus = getEffectiveOrderStatus(saleBase, trackingSnapshot, latestShipment)

        const sale = {
          ...saleBase,
          original_status: saleBase?.status,
          status: effectiveStatus,
          effective_status: effectiveStatus
        }

        setDetail({
          sale,
          items,
          shipments,
          trackingSnapshot,
          latestShipment
        })

        setSales((prev) =>
          prev.map((row) =>
            String(row.id) === String(id)
              ? {
                  ...row,
                  original_status: row.original_status || row.status,
                  status: effectiveStatus,
                  effective_status: effectiveStatus,
                  shipments_summary: shipments,
                  latest_shipment: latestShipment,
                  trackingSnapshot
                }
              : row
          )
        )
      } catch {
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [authHeaders, fetchJsonSafe]
  )

  const resetFilters = () => {
    setStatus('ALL')
    setPaymentFilter('ALL')
    setStageFilter('ALL')
    setQ('')
    setFrom('')
    setTo('')
  }

  return (
    <div className="sales-page">
      <Navbar />

      <div className="sales-shell">
        <div className="sales-hero">
          <div className="sales-hero-main">
            <div className="sales-kicker">Order Management</div>
            <h1 className="sales-title">Sales Dashboard</h1>
            <p className="sales-subtitle">Review recent orders, payment status, shipment progress, and complete order details.</p>
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
          <div className="sales-stat-card soft-purple">
            <span className="sales-stat-label">Delivered</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.delivered}</span>
          </div>
          <div className="sales-stat-card soft-red">
            <span className="sales-stat-label">Cancelled</span>
            <span className="sales-stat-value">{loading ? '...' : statusCounts.cancelled}</span>
          </div>
        </div>

        <div className="sales-filters-card">
          <div className="sales-section-top">
            <div className="sales-section-copy">
              <h2 className="sales-section-title">Filters</h2>
              <p className="sales-section-subtitle">Narrow down orders using status, payment, date, tracking, or customer information.</p>
            </div>
            <button className="sales-reset-btn" onClick={resetFilters}>
              Reset
            </button>
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
                  placeholder="Search order id, name, mobile, email, AWB"
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
              <span className="sales-loader-text">Fetching latest orders and shipment status</span>
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
                <colgroup>
                  <col className="sales-col-order" />
                  <col className="sales-col-date" />
                  <col className="sales-col-status" />
                  <col className="sales-col-payment" />
                  <col className="sales-col-customer" />
                  <col className="sales-col-mobile" />
                  <col className="sales-col-email" />
                  <col className="sales-col-awb" />
                  <col className="sales-col-amount" />
                  <col className="sales-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Placed at</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>AWB</th>
                    <th className="align-right">Payable</th>
                    <th className="align-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((s) => {
                    const displayStatus = getEffectiveOrderStatus(s, s?.trackingSnapshot || null, s?.latest_shipment || null)
                    const paymentMode = normalizePayMode(s.payment_status || s.payment_method)
                    const awb = s?.latest_shipment?.awb || s?.awb || '-'
                    const customer = getCustomerLabel(s)
                    const email = s.customer_email || '-'
                    const mobile = s.customer_mobile || '-'

                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="sales-order-id">#{s.id}</span>
                        </td>
                        <td>
                          <span className="sales-date-text">{displayDate(s.created_at)}</span>
                        </td>
                        <td>
                          <span className={`sales-status-pill sales-status-${String(displayStatus || '').toLowerCase()}`}>{displayStatus || '-'}</span>
                        </td>
                        <td>
                          <span className={`sales-payment-pill sales-payment-${String(paymentMode || '').toLowerCase()}`}>{paymentMode || '-'}</span>
                        </td>
                        <td>
                          <span className="sales-cell-text sales-text-main" title={customer}>
                            {customer}
                          </span>
                        </td>
                        <td>
                          <span className="sales-cell-text sales-text-main" title={mobile}>
                            {mobile}
                          </span>
                        </td>
                        <td>
                          <span className="sales-cell-text sales-text-soft" title={email}>
                            {email}
                          </span>
                        </td>
                        <td>
                          <span className="sales-cell-text sales-text-soft" title={awb}>
                            {awb}
                          </span>
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