import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './Transaction.css'
import NavbarAdmin from './NavbarAdmin'

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  'https://taras-kart-backend.vercel.app/api'

function asNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normStr(v) {
  return String(v == null ? '' : v).trim()
}

function toDateStr(iso) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function safeUpper(v) {
  return normStr(v).toUpperCase()
}

function money(n) {
  const x = asNum(n)
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function derivePaymentMeta(row) {
  const paymentStatus = safeUpper(row.payment_status)
  const paymentRef = normStr(row.payment_ref)
  const paymentMethod = safeUpper(row.payment_method)
  const source = safeUpper(row.source)

  const isCOD = paymentStatus === 'COD' || paymentMethod === 'COD'
  const isPaid = paymentStatus === 'PAID'
  const isPending = paymentStatus === 'PENDING'
  const isFailed = paymentStatus === 'FAILED'

  let paymentType = isCOD ? 'COD' : 'PREPAID'

  if (!isCOD && isPaid && !paymentRef && paymentMethod === 'COD') paymentType = 'COD'
  if (!isCOD && isPaid && paymentRef) paymentType = 'PREPAID'

  let receivedFrom = paymentType === 'COD' ? 'Shiprocket' : 'Razorpay'

  if (paymentType === 'PREPAID' && paymentMethod && paymentMethod !== 'RAZORPAY') {
    receivedFrom = paymentMethod
  }

  let paymentReceived = false
  if (paymentType === 'COD') {
    paymentReceived = isPaid
  } else {
    paymentReceived = isPaid
  }

  let paymentState = 'PENDING'
  if (isFailed) paymentState = 'FAILED'
  if (isPending) paymentState = 'PENDING'
  if (isPaid) paymentState = 'RECEIVED'
  if (paymentType === 'COD' && paymentStatus === 'COD') paymentState = 'NOT_RECEIVED'

  const channel = source || 'WEB'

  return { paymentType, receivedFrom, paymentReceived, paymentState, channel }
}

function statusPillClass(v) {
  const s = safeUpper(v)
  if (s === 'CANCELLED' || s === 'FAILED' || s === 'RTO') return 'danger'
  if (s === 'DELIVERED' || s === 'RECEIVED' || s === 'PAID') return 'ok'
  if (s === 'PLACED' || s === 'CONFIRMED' || s === 'PENDING') return 'info'
  return 'warn'
}

export default function Transaction() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [activeChip, setActiveChip] = useState('ALL')

  const [filters, setFilters] = useState({
    q: '',
    email: '',
    mobile: '',
    status: '',
    paymentType: '',
    paymentState: '',
    channel: '',
    dateFrom: '',
    dateTo: ''
  })

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    ''

  const fetchTx = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        credentials: 'include'
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setRows([])
        setErr(data?.message || 'Failed to load transactions')
        setLoading(false)
        return
      }
      setRows(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch {
      setRows([])
      setErr('Failed to load transactions')
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchTx()
  }, [fetchTx])

  const enriched = useMemo(() => {
    return (rows || []).map(r => {
      const totals = typeof r.totals === 'string' ? (() => { try { return JSON.parse(r.totals) } catch { return null } })() : r.totals
      const payable = totals?.payable != null ? asNum(totals.payable) : asNum(r.total)
      const meta = derivePaymentMeta(r)
      return {
        ...r,
        _totalsObj: totals,
        _payable: payable,
        _paymentType: meta.paymentType,
        _receivedFrom: meta.receivedFrom,
        _paymentReceived: meta.paymentReceived,
        _paymentState: meta.paymentState,
        _channel: meta.channel
      }
    })
  }, [rows])

  const chipFiltered = useMemo(() => {
    const list = enriched
    const chip = safeUpper(activeChip)

    if (chip === 'ALL') return list
    if (chip === 'COD') return list.filter(x => x._paymentType === 'COD')
    if (chip === 'PREPAID') return list.filter(x => x._paymentType === 'PREPAID')
    if (chip === 'RECEIVED') return list.filter(x => x._paymentState === 'RECEIVED')
    if (chip === 'PENDING') return list.filter(x => x._paymentState === 'PENDING' || x._paymentState === 'NOT_RECEIVED')
    if (chip === 'CANCELLED') return list.filter(x => safeUpper(x.status) === 'CANCELLED')
    return list
  }, [enriched, activeChip])

  const filtered = useMemo(() => {
    const q = safeUpper(filters.q)
    const email = safeUpper(filters.email)
    const mobile = filters.mobile.replace(/\D/g, '')
    const status = safeUpper(filters.status)
    const paymentType = safeUpper(filters.paymentType)
    const paymentState = safeUpper(filters.paymentState)
    const channel = safeUpper(filters.channel)

    let fromTs = 0
    let toTs = 0
    if (filters.dateFrom) {
      const d = new Date(filters.dateFrom)
      if (!Number.isNaN(d.getTime())) fromTs = d.getTime()
    }
    if (filters.dateTo) {
      const d = new Date(filters.dateTo)
      if (!Number.isNaN(d.getTime())) toTs = d.getTime() + 24 * 60 * 60 * 1000 - 1
    }

    return chipFiltered.filter(r => {
      const rowStatus = safeUpper(r.status)
      const rowEmail = safeUpper(r.customer_email)
      const rowName = safeUpper(r.customer_name)
      const rowMobile = normStr(r.customer_mobile).replace(/\D/g, '')
      const rowId = normStr(r.id)
      const rowChannel = safeUpper(r._channel)
      const rowPaymentType = safeUpper(r._paymentType)
      const rowPaymentState = safeUpper(r._paymentState)

      if (q) {
        const hit =
          rowEmail.includes(q) ||
          rowName.includes(q) ||
          rowMobile.includes(q) ||
          rowId.includes(filters.q)
        if (!hit) return false
      }

      if (email && rowEmail !== email) return false
      if (mobile && rowMobile !== mobile) return false
      if (status && rowStatus !== status) return false
      if (paymentType && rowPaymentType !== paymentType) return false
      if (paymentState && rowPaymentState !== paymentState) return false
      if (channel && rowChannel !== channel) return false

      if (fromTs || toTs) {
        const t = new Date(r.created_at).getTime()
        if (fromTs && t < fromTs) return false
        if (toTs && t > toTs) return false
      }

      return true
    })
  }, [chipFiltered, filters])

  const stats = useMemo(() => {
    const list = filtered
    const count = list.length

    const cod = list.filter(x => x._paymentType === 'COD').length
    const prepaid = list.filter(x => x._paymentType === 'PREPAID').length
    const received = list.filter(x => x._paymentState === 'RECEIVED').length
    const pending = list.filter(x => x._paymentState !== 'RECEIVED').length
    const cancelled = list.filter(x => safeUpper(x.status) === 'CANCELLED').length

    const totalAmount = list.reduce((a, x) => a + asNum(x._payable), 0)
    const receivedAmount = list
      .filter(x => x._paymentState === 'RECEIVED')
      .reduce((a, x) => a + asNum(x._payable), 0)

    return {
      count,
      cod,
      prepaid,
      received,
      pending,
      cancelled,
      totalAmount,
      receivedAmount
    }
  }, [filtered])

  const onReset = () => {
    setFilters({
      q: '',
      email: '',
      mobile: '',
      status: '',
      paymentType: '',
      paymentState: '',
      channel: '',
      dateFrom: '',
      dateTo: ''
    })
    setActiveChip('ALL')
  }

  return (
    <div className="transaction-page">
      <NavbarAdmin />
      <div className="transaction-header">
        <h2>Transactions</h2>
        <p>
          COD is counted as received only when payment status is PAID (Shiprocket remitted). Prepaid is
          counted as received only when payment status is PAID (Razorpay captured).
        </p>
      </div>

      <div className="stats-row">
        <div className="stat-card info">
          <div className="stat-title">Total Transactions</div>
          <div className="stat-value">{stats.count}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-title">Pending / Not Received</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-title">Received</div>
          <div className="stat-value">{stats.received}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Amount</div>
          <div className="stat-value">₹ {money(stats.totalAmount)}</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-title">Received Amount</div>
          <div className="stat-value">₹ {money(stats.receivedAmount)}</div>
        </div>
      </div>

      <div className="chip-bar">
        {['ALL', 'COD', 'PREPAID', 'RECEIVED', 'PENDING', 'CANCELLED'].map(c => (
          <button
            key={c}
            className={`chip ${activeChip === c ? 'active' : ''}`}
            onClick={() => setActiveChip(c)}
            type="button"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="transaction-filter">
        <h3>Filters</h3>

        <div className="filter-grid">
          <input
            value={filters.q}
            onChange={e => setFilters(s => ({ ...s, q: e.target.value }))}
            placeholder="Search (name/email/mobile/order id)"
          />

          <input
            value={filters.email}
            onChange={e => setFilters(s => ({ ...s, email: e.target.value }))}
            placeholder="Exact Email"
          />

          <input
            value={filters.mobile}
            onChange={e => setFilters(s => ({ ...s, mobile: e.target.value }))}
            placeholder="Exact Mobile"
          />

          <select
            value={filters.status}
            onChange={e => setFilters(s => ({ ...s, status: e.target.value }))}
          >
            <option value="">Order Status</option>
            <option value="PLACED">PLACED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="RTO">RTO</option>
          </select>

          <select
            value={filters.paymentType}
            onChange={e => setFilters(s => ({ ...s, paymentType: e.target.value }))}
          >
            <option value="">Payment Type</option>
            <option value="COD">COD</option>
            <option value="PREPAID">PREPAID</option>
          </select>

          <select
            value={filters.paymentState}
            onChange={e => setFilters(s => ({ ...s, paymentState: e.target.value }))}
          >
            <option value="">Payment State</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="PENDING">PENDING</option>
            <option value="NOT_RECEIVED">NOT_RECEIVED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            value={filters.channel}
            onChange={e => setFilters(s => ({ ...s, channel: e.target.value }))}
          >
            <option value="">Channel</option>
            <option value="WEB">WEB</option>
            <option value="POS">POS</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(s => ({ ...s, dateFrom: e.target.value }))}
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters(s => ({ ...s, dateTo: e.target.value }))}
          />

          <button type="button" onClick={fetchTx}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button type="button" onClick={onReset}>
            Reset
          </button>
        </div>

        {err ? <p style={{ marginTop: 12, color: '#ff6b6b' }}>{err}</p> : null}
      </div>

      <div className="transaction-table">
        <h3>Transaction List</h3>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Channel</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment Type</th>
                <th>Received From</th>
                <th>Payment State</th>
                <th>Order Status</th>
                <th>Payment Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: 16 }}>
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const orderShort = normStr(r.id).slice(0, 8)
                  const customer = normStr(r.customer_name) || 'Unknown'
                  const email = normStr(r.customer_email)
                  const mobile = normStr(r.customer_mobile)
                  const amount = r._payable
                  const orderStatus = safeUpper(r.status)
                  const paymentStatus = safeUpper(r.payment_status)

                  return (
                    <tr key={r.id}>
                      <td>{toDateStr(r.created_at)}</td>
                      <td>{orderShort}</td>
                      <td>{r._channel}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{customer}</span>
                          {email ? <span style={{ fontSize: 12, color: '#d9d9d9' }}>{email}</span> : null}
                          {mobile ? <span style={{ fontSize: 12, color: '#d9d9d9' }}>{mobile}</span> : null}
                        </div>
                      </td>
                      <td>₹ {money(amount)}</td>
                      <td>
                        <span className={`status-pill ${statusPillClass(r._paymentType)}`}>
                          {r._paymentType}
                        </span>
                      </td>
                      <td>{r._receivedFrom}</td>
                      <td>
                        <span className={`status-pill ${statusPillClass(r._paymentState)}`}>
                          {r._paymentState}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${statusPillClass(orderStatus)}`}>
                          {orderStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${statusPillClass(paymentStatus)}`}>
                          {paymentStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}