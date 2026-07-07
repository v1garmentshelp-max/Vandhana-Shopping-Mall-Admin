import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './Transaction.css'
import NavbarAdmin from './NavbarAdmin'
import { useAuth } from './AdminAuth'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const PROCESS_ENV = typeof process !== 'undefined' && process.env ? process.env : {}
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  PROCESS_ENV.REACT_APP_API_BASE ||
  PROCESS_ENV.REACT_APP_API_BASE_URL ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '').replace(/\/api$/, '')

function asNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normStr(v) {
  return String(v == null ? '' : v).trim()
}

function safeUpper(v) {
  return normStr(v).toUpperCase()
}

function toArray(x) {
  if (Array.isArray(x)) return x
  if (Array.isArray(x?.data)) return x.data
  if (Array.isArray(x?.rows)) return x.rows
  if (Array.isArray(x?.items)) return x.items
  if (Array.isArray(x?.orders)) return x.orders
  if (Array.isArray(x?.sales)) return x.sales
  if (Array.isArray(x?.transactions)) return x.transactions
  return []
}

function toDateStr(value) {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN')
}

function toDateOnly(value) {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })
}

function money(n) {
  const x = asNum(n)
  return x.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function parseTotals(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function getPayable(row) {
  const totals = parseTotals(row?.totals)
  return asNum(totals.payable ?? totals.total ?? totals.subtotal ?? totals.bagTotal ?? row?.total ?? row?.amount ?? 0)
}

function pickValue(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
}

function latestObject(arr) {
  if (!Array.isArray(arr) || !arr.length) return null

  return [...arr].sort((a, b) => {
    const ad = new Date(
      a?.updated_at ||
        a?.created_at ||
        a?.remittance_date ||
        a?.remittance_scheduled_to ||
        a?.remittance_scheduled_from ||
        0
    ).getTime()

    const bd = new Date(
      b?.updated_at ||
        b?.created_at ||
        b?.remittance_date ||
        b?.remittance_scheduled_to ||
        b?.remittance_scheduled_from ||
        0
    ).getTime()

    return bd - ad
  })[0]
}

function normalizeOrderStatus(value) {
  const s = safeUpper(value)

  if (!s) return ''
  if (s.includes('CANCEL')) return 'CANCELLED'
  if (s.includes('RTO')) return 'RTO'
  if (s.includes('DELIVER')) return 'DELIVERED'
  if (s.includes('OUT FOR DELIVERY') || s.includes('OUT_FOR_DELIVERY')) return 'SHIPPED'
  if (
    s.includes('IN TRANSIT') ||
    s.includes('TRANSIT') ||
    s.includes('DISPATCH') ||
    s.includes('SHIPPED') ||
    s.includes('PICKED') ||
    s.includes('PICKUP')
  ) {
    return 'SHIPPED'
  }
  if (s.includes('PACKED') || s.includes('MANIFEST') || s.includes('AWB') || s.includes('READY TO SHIP')) return 'PACKED'
  if (s.includes('CONFIRM') || s.includes('PROCESSING') || s.includes('ACCEPTED') || s.includes('CREATED')) return 'CONFIRMED'
  if (s.includes('PLACED') || s.includes('NEW')) return 'PLACED'

  return s
}

function normalizeRemittanceStatus(value) {
  const s = safeUpper(value)

  if (!s) return ''
  if (s.includes('NOT_RECEIVED')) return 'NOT_RECEIVED'
  if (s.includes('SCHEDULED') || s.includes('PROCESSING') || s.includes('INITIATED')) return 'SCHEDULED'
  if (s.includes('FAILED') || s.includes('REJECTED')) return 'FAILED'
  if (s.includes('HOLD')) return 'ON_HOLD'
  if (s.includes('PENDING')) return 'PENDING'
  if (s.includes('RECEIVED') || s.includes('REMITTED') || s.includes('SETTLED') || s.includes('PAID') || s.includes('TRANSFERRED') || s.includes('CREDITED')) return 'RECEIVED'

  return s
}

function getRemittance(row) {
  const fromArray =
    latestObject(row?.cod_remittances) ||
    latestObject(row?.remittances) ||
    latestObject(row?.codRemittances)

  const obj =
    fromArray ||
    row?.cod_remittance ||
    row?.codRemittance ||
    row?.remittance ||
    row?.latest_cod_remittance ||
    row?.latestCodRemittance ||
    {}

  return {
    status: pickValue(
      obj.remittance_status,
      obj.status,
      row.remittance_status,
      row.cod_remittance_status,
      row.codRemittanceStatus
    ),
    utr: pickValue(
      obj.remittance_utr,
      obj.utr,
      obj.utr_number,
      obj.transaction_reference,
      row.remittance_utr,
      row.utr,
      row.utr_number
    ),
    date: pickValue(
      obj.remittance_date,
      obj.settlement_date,
      obj.payment_date,
      obj.received_at,
      row.remittance_date,
      row.settlement_date
    ),
    scheduledFrom: pickValue(
      obj.remittance_scheduled_from,
      obj.scheduled_from,
      row.remittance_scheduled_from,
      row.scheduled_from
    ),
    scheduledTo: pickValue(
      obj.remittance_scheduled_to,
      obj.scheduled_to,
      row.remittance_scheduled_to,
      row.scheduled_to
    ),
    amount: pickValue(obj.cod_amount, obj.amount, obj.remittance_amount, row.cod_amount, row.remittance_amount),
    awb: pickValue(obj.awb, row.awb, row.latest_shipment?.awb, row.shipment?.awb),
    shiprocketOrderId: pickValue(
      obj.shiprocket_order_id,
      row.shiprocket_order_id,
      row.latest_shipment?.shiprocket_order_id,
      row.shipment?.shiprocket_order_id
    ),
    shiprocketShipmentId: pickValue(
      obj.shiprocket_shipment_id,
      row.shiprocket_shipment_id,
      row.latest_shipment?.shiprocket_shipment_id,
      row.shipment?.shiprocket_shipment_id
    )
  }
}

function getBankDateText(remittance, bankSettlementState) {
  if (bankSettlementState === 'RECEIVED' && remittance.date) {
    return toDateOnly(remittance.date)
  }

  if (bankSettlementState === 'SCHEDULED') {
    const from = toDateOnly(remittance.scheduledFrom)
    const to = toDateOnly(remittance.scheduledTo)

    if (from && to) return `${from} to ${to}`
    if (to) return `Expected by ${to}`
    if (from) return `From ${from}`

    return 'Scheduled'
  }

  if (bankSettlementState === 'NOT_RECEIVED') return 'Not received'
  if (bankSettlementState === 'PENDING') return 'Pending'
  if (bankSettlementState === 'FAILED') return 'Failed'
  if (bankSettlementState === 'ON_HOLD') return 'On hold'
  if (bankSettlementState === 'NA') return '-'

  return '-'
}

function derivePaymentMeta(row) {
  const paymentStatus = safeUpper(row.payment_status)
  const paymentRef = normStr(row.payment_ref)
  const paymentMethod = safeUpper(row.payment_method)
  const source = safeUpper(row.source) || 'WEB'
  const orderStatus = normalizeOrderStatus(row.effective_status || row.status || row.order_status)
  const remittance = getRemittance(row)
  const remittanceStatus = normalizeRemittanceStatus(remittance.status)

  const isCOD = paymentStatus === 'COD' || paymentMethod === 'COD'
  const isPrepaidPaid =
    paymentStatus === 'PAID' ||
    paymentStatus === 'SUCCESS' ||
    paymentStatus === 'PAYMENT_SUCCESS' ||
    paymentStatus === 'RECEIVED'

  const isFailed = paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED'
  const isPending = paymentStatus === 'PENDING' || paymentStatus === 'CREATED' || paymentStatus === 'INITIATED'
  const paymentType = isCOD ? 'COD' : 'PREPAID'

  let collectionPartner = paymentType === 'COD' ? 'Shiprocket Courier' : 'Razorpay'

  if (paymentType === 'PREPAID' && paymentMethod && paymentMethod !== 'ONLINE') {
    collectionPartner = paymentMethod
  }

  if (paymentRef && paymentType === 'PREPAID') {
    collectionPartner = paymentMethod || 'Razorpay'
  }

  let customerPaymentState = 'PENDING'
  let bankSettlementState = 'NA'

  if (paymentType === 'COD') {
    if (orderStatus === 'DELIVERED') customerPaymentState = 'COLLECTED'
    else if (orderStatus === 'CANCELLED' || orderStatus === 'RTO') customerPaymentState = 'NOT_COLLECTED'
    else customerPaymentState = 'COD_PENDING'

    if (remittanceStatus === 'RECEIVED') bankSettlementState = 'RECEIVED'
    else if (remittanceStatus === 'SCHEDULED') bankSettlementState = 'SCHEDULED'
    else if (remittanceStatus === 'FAILED') bankSettlementState = 'FAILED'
    else if (remittanceStatus === 'ON_HOLD') bankSettlementState = 'ON_HOLD'
    else if (remittanceStatus === 'PENDING') bankSettlementState = 'PENDING'
    else if (remittanceStatus === 'NOT_RECEIVED') bankSettlementState = 'NOT_RECEIVED'
    else if (orderStatus === 'DELIVERED') bankSettlementState = 'NOT_RECEIVED'
    else bankSettlementState = 'PENDING'
  } else {
    if (isFailed) customerPaymentState = 'FAILED'
    else if (isPrepaidPaid) customerPaymentState = 'RECEIVED'
    else if (isPending) customerPaymentState = 'PENDING'
    else customerPaymentState = 'PENDING'

    bankSettlementState = 'NA'
  }

  const remittanceAmount = asNum(remittance.amount) || getPayable(row)

  return {
    paymentType,
    collectionPartner,
    customerPaymentState,
    bankSettlementState,
    channel: source,
    orderStatus,
    remittance,
    remittanceAmount,
    bankDateText: getBankDateText(remittance, bankSettlementState)
  }
}

function statusPillClass(v) {
  const s = safeUpper(v)

  if (s === 'CANCELLED' || s === 'FAILED' || s === 'RTO' || s === 'NOT_RECEIVED' || s === 'NOT_COLLECTED') return 'danger'
  if (s === 'DELIVERED' || s === 'RECEIVED' || s === 'PAID' || s === 'SUCCESS' || s === 'COLLECTED') return 'ok'
  if (s === 'PLACED' || s === 'CONFIRMED' || s === 'PENDING' || s === 'COD' || s === 'PREPAID' || s === 'COD_PENDING') return 'info'
  if (s === 'SCHEDULED' || s === 'REMITTANCE_SCHEDULED' || s === 'PACKED' || s === 'SHIPPED' || s === 'ON_HOLD') return 'warn'
  if (s === 'NA') return 'muted'

  return 'warn'
}

function displayStatus(v) {
  const s = safeUpper(v)
  if (!s) return '-'
  if (s === 'NA') return 'N/A'
  return s
}

function shortOrderId(id) {
  const s = normStr(id)
  if (!s) return '-'
  return s.length > 12 ? s.slice(0, 8) : s
}

export default function Transaction() {
  const { token } = useAuth()
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
    customerPayment: '',
    bankSettlement: '',
    channel: '',
    dateFrom: '',
    dateTo: ''
  })

  const authToken =
    token ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    ''

  const fetchJson = useCallback(
    async (url) => {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        credentials: 'omit',
        mode: 'cors'
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.message || `Request failed with status ${res.status}`)
      }

      return data
    },
    [authToken]
  )

  const fetchTx = useCallback(async () => {
    setLoading(true)
    setErr('')

    try {
      let data = null

      try {
        data = await fetchJson(`${API_BASE}/api/transactions/admin`)
      } catch {
        try {
          data = await fetchJson(`${API_BASE}/api/sales/admin`)
        } catch {
          data = await fetchJson(`${API_BASE}/api/orders`)
        }
      }

      setRows(toArray(data))
    } catch (e) {
      setRows([])
      setErr(e?.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    fetchTx()
  }, [fetchTx])

  const enriched = useMemo(() => {
    return toArray(rows).map((r) => {
      const totals = parseTotals(r.totals)
      const payable = getPayable(r)
      const meta = derivePaymentMeta(r)

      return {
        ...r,
        _totalsObj: totals,
        _payable: payable,
        _paymentType: meta.paymentType,
        _collectionPartner: meta.collectionPartner,
        _customerPaymentState: meta.customerPaymentState,
        _bankSettlementState: meta.bankSettlementState,
        _channel: meta.channel,
        _orderStatus: meta.orderStatus,
        _remittance: meta.remittance,
        _remittanceAmount: meta.remittanceAmount,
        _bankDateText: meta.bankDateText
      }
    })
  }, [rows])

  const chipFiltered = useMemo(() => {
    const list = enriched
    const chip = safeUpper(activeChip)

    if (chip === 'ALL') return list
    if (chip === 'COD') return list.filter((x) => x._paymentType === 'COD')
    if (chip === 'PREPAID') return list.filter((x) => x._paymentType === 'PREPAID')
    if (chip === 'CUSTOMER_PAID') return list.filter((x) => ['COLLECTED', 'RECEIVED'].includes(x._customerPaymentState))
    if (chip === 'BANK_RECEIVED') return list.filter((x) => x._bankSettlementState === 'RECEIVED')
    if (chip === 'BANK_PENDING') return list.filter((x) => ['PENDING', 'NOT_RECEIVED', 'ON_HOLD', 'SCHEDULED'].includes(x._bankSettlementState))
    if (chip === 'CANCELLED') return list.filter((x) => safeUpper(x.status) === 'CANCELLED')

    return list
  }, [enriched, activeChip])

  const filtered = useMemo(() => {
    const q = safeUpper(filters.q)
    const email = safeUpper(filters.email)
    const mobile = filters.mobile.replace(/\D/g, '')
    const status = safeUpper(filters.status)
    const paymentType = safeUpper(filters.paymentType)
    const customerPayment = safeUpper(filters.customerPayment)
    const bankSettlement = safeUpper(filters.bankSettlement)
    const channel = safeUpper(filters.channel)

    let fromTs = 0
    let toTs = 0

    if (filters.dateFrom) {
      const d = new Date(`${filters.dateFrom}T00:00:00`)
      if (!Number.isNaN(d.getTime())) fromTs = d.getTime()
    }

    if (filters.dateTo) {
      const d = new Date(`${filters.dateTo}T23:59:59`)
      if (!Number.isNaN(d.getTime())) toTs = d.getTime()
    }

    return chipFiltered.filter((r) => {
      const rowStatus = safeUpper(r._orderStatus || r.status)
      const rowEmail = safeUpper(r.customer_email)
      const rowName = safeUpper(r.customer_name)
      const rowMobile = normStr(r.customer_mobile).replace(/\D/g, '')
      const rowId = normStr(r.id)
      const rowChannel = safeUpper(r._channel)
      const rowPaymentType = safeUpper(r._paymentType)
      const rowCustomerPayment = safeUpper(r._customerPaymentState)
      const rowBankSettlement = safeUpper(r._bankSettlementState)
      const awb = safeUpper(r._remittance?.awb || r.awb || r.latest_shipment?.awb)

      if (q) {
        const hit =
          rowEmail.includes(q) ||
          rowName.includes(q) ||
          rowMobile.includes(q) ||
          rowId.toUpperCase().includes(q) ||
          awb.includes(q)

        if (!hit) return false
      }

      if (email && rowEmail !== email) return false
      if (mobile && rowMobile !== mobile) return false
      if (status && rowStatus !== status) return false
      if (paymentType && rowPaymentType !== paymentType) return false
      if (customerPayment && rowCustomerPayment !== customerPayment) return false
      if (bankSettlement && rowBankSettlement !== bankSettlement) return false
      if (channel && rowChannel !== channel) return false

      if (fromTs || toTs) {
        const t = new Date(r.created_at).getTime()
        if (!Number.isFinite(t)) return false
        if (fromTs && t < fromTs) return false
        if (toTs && t > toTs) return false
      }

      return true
    })
  }, [chipFiltered, filters])

  const stats = useMemo(() => {
    const list = filtered

    const count = list.length
    const cod = list.filter((x) => x._paymentType === 'COD').length
    const prepaid = list.filter((x) => x._paymentType === 'PREPAID').length
    const customerPaid = list.filter((x) => ['COLLECTED', 'RECEIVED'].includes(x._customerPaymentState)).length
    const customerPending = list.filter((x) => ['PENDING', 'COD_PENDING'].includes(x._customerPaymentState)).length
    const bankReceived = list.filter((x) => x._bankSettlementState === 'RECEIVED').length
    const bankPending = list.filter((x) => ['PENDING', 'NOT_RECEIVED', 'ON_HOLD', 'SCHEDULED'].includes(x._bankSettlementState)).length
    const cancelled = list.filter((x) => safeUpper(x.status) === 'CANCELLED').length
    const totalAmount = list.reduce((a, x) => a + asNum(x._payable), 0)
    const customerPaidAmount = list
      .filter((x) => ['COLLECTED', 'RECEIVED'].includes(x._customerPaymentState))
      .reduce((a, x) => a + asNum(x._payable), 0)
    const bankReceivedAmount = list
      .filter((x) => x._bankSettlementState === 'RECEIVED')
      .reduce((a, x) => a + asNum(x._remittanceAmount || x._payable), 0)
    const bankPendingAmount = list
      .filter((x) => ['PENDING', 'NOT_RECEIVED', 'ON_HOLD', 'SCHEDULED'].includes(x._bankSettlementState))
      .reduce((a, x) => a + asNum(x._remittanceAmount || x._payable), 0)

    return {
      count,
      cod,
      prepaid,
      customerPaid,
      customerPending,
      bankReceived,
      bankPending,
      cancelled,
      totalAmount,
      customerPaidAmount,
      bankReceivedAmount,
      bankPendingAmount
    }
  }, [filtered])

  const onReset = () => {
    setFilters({
      q: '',
      email: '',
      mobile: '',
      status: '',
      paymentType: '',
      customerPayment: '',
      bankSettlement: '',
      channel: '',
      dateFrom: '',
      dateTo: ''
    })
    setActiveChip('ALL')
  }

  return (
    <div className="transaction-page">
      <NavbarAdmin />

      <div className="transaction-wrapper">
        <div className="transaction-header">
          <div>
            <h2>Transactions</h2>
            <p>Separate customer payment from Shiprocket bank settlement so COD does not show received until money reaches your account.</p>
          </div>

          <button type="button" className="transaction-refresh-top" onClick={fetchTx}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="stats-row">
          <div className="stat-card info">
            <div className="stat-title">Total Transactions</div>
            <div className="stat-value">{stats.count}</div>
          </div>

          <div className="stat-card">
            <div className="stat-title">COD</div>
            <div className="stat-value">{stats.cod}</div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Prepaid</div>
            <div className="stat-value">{stats.prepaid}</div>
          </div>

          <div className="stat-card accent">
            <div className="stat-title">Customer Paid</div>
            <div className="stat-value">{stats.customerPaid}</div>
          </div>

          <div className="stat-card warn">
            <div className="stat-title">Customer Pending</div>
            <div className="stat-value">{stats.customerPending}</div>
          </div>

          <div className="stat-card accent">
            <div className="stat-title">Bank Received</div>
            <div className="stat-value">{stats.bankReceived}</div>
          </div>

          <div className="stat-card danger">
            <div className="stat-title">Bank Pending</div>
            <div className="stat-value">{stats.bankPending}</div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Total Amount</div>
            <div className="stat-value">₹ {money(stats.totalAmount)}</div>
          </div>

          <div className="stat-card accent">
            <div className="stat-title">Customer Paid Amount</div>
            <div className="stat-value">₹ {money(stats.customerPaidAmount)}</div>
          </div>

          <div className="stat-card accent">
            <div className="stat-title">Bank Received Amount</div>
            <div className="stat-value">₹ {money(stats.bankReceivedAmount)}</div>
          </div>

          <div className="stat-card danger">
            <div className="stat-title">Bank Pending Amount</div>
            <div className="stat-value">₹ {money(stats.bankPendingAmount)}</div>
          </div>

          <div className="stat-card danger">
            <div className="stat-title">Cancelled</div>
            <div className="stat-value">{stats.cancelled}</div>
          </div>
        </div>

        <div className="chip-bar">
          {['ALL', 'COD', 'PREPAID', 'CUSTOMER_PAID', 'BANK_RECEIVED', 'BANK_PENDING', 'CANCELLED'].map((c) => (
            <button
              key={c}
              className={`chip ${activeChip === c ? 'active' : ''}`}
              onClick={() => setActiveChip(c)}
              type="button"
            >
              {c.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="transaction-filter">
          <div className="section-head">
            <h3>Filters</h3>
          </div>

          <div className="filter-grid">
            <input
              value={filters.q}
              onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
              placeholder="Search name, email, mobile, order id or AWB"
            />

            <input
              value={filters.email}
              onChange={(e) => setFilters((s) => ({ ...s, email: e.target.value }))}
              placeholder="Exact Email"
            />

            <input
              value={filters.mobile}
              onChange={(e) => setFilters((s) => ({ ...s, mobile: e.target.value }))}
              placeholder="Exact Mobile"
            />

            <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">Order Status</option>
              <option value="PLACED">PLACED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PACKED">PACKED</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="RTO">RTO</option>
            </select>

            <select value={filters.paymentType} onChange={(e) => setFilters((s) => ({ ...s, paymentType: e.target.value }))}>
              <option value="">Payment Type</option>
              <option value="COD">COD</option>
              <option value="PREPAID">PREPAID</option>
            </select>

            <select value={filters.customerPayment} onChange={(e) => setFilters((s) => ({ ...s, customerPayment: e.target.value }))}>
              <option value="">Customer Payment</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="COD_PENDING">COD_PENDING</option>
              <option value="PENDING">PENDING</option>
              <option value="NOT_COLLECTED">NOT_COLLECTED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select value={filters.bankSettlement} onChange={(e) => setFilters((s) => ({ ...s, bankSettlement: e.target.value }))}>
              <option value="">Shiprocket Bank Settlement</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="NOT_RECEIVED">NOT_RECEIVED</option>
              <option value="PENDING">PENDING</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="FAILED">FAILED</option>
              <option value="NA">N/A</option>
            </select>

            <select value={filters.channel} onChange={(e) => setFilters((s) => ({ ...s, channel: e.target.value }))}>
              <option value="">Channel</option>
              <option value="WEB">WEB</option>
              <option value="POS">POS</option>
              <option value="ADMIN">ADMIN</option>
              <option value="B2B">B2B</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
            />

            <button type="button" onClick={fetchTx}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>

            <button type="button" className="reset-btn" onClick={onReset}>
              Reset
            </button>
          </div>

          {err ? <p className="error-text">{err}</p> : null}
        </div>

        <div className="transaction-table">
          <div className="section-head transaction-list-head">
            <h3>Transaction List</h3>
            <span>{filtered.length} records</span>
          </div>

          <div className="table-scroll">
            <table className="transaction-table-main">
              <colgroup>
                <col className="col-date" />
                <col className="col-order" />
                <col className="col-channel" />
                <col className="col-customer" />
                <col className="col-awb" />
                <col className="col-amount" />
                <col className="col-type" />
                <col className="col-partner" />
                <col className="col-customer-payment" />
                <col className="col-bank-settlement" />
                <col className="col-bank-date" />
                <col className="col-utr" />
                <col className="col-order-status" />
                <col className="col-payment-status" />
              </colgroup>

              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Channel</th>
                  <th>Customer</th>
                  <th>AWB</th>
                  <th>Amount</th>
                  <th>Payment Type</th>
                  <th>Collection Partner</th>
                  <th>Customer Payment</th>
                  <th>Shiprocket Bank Settlement</th>
                  <th>Bank Expected / Received Date</th>
                  <th>UTR</th>
                  <th>Order Status</th>
                  <th>Payment Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="14" className="empty-cell">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="empty-cell">
                      {rows.length ? 'No matching transactions found' : 'No transactions found'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const customer = normStr(r.customer_name) || 'Unknown'
                    const email = normStr(r.customer_email)
                    const mobile = normStr(r.customer_mobile)
                    const orderStatus = safeUpper(r._orderStatus || r.status)
                    const paymentStatus = safeUpper(r.payment_status)
                    const awb = normStr(r._remittance?.awb || r.awb || r.latest_shipment?.awb) || '-'
                    const utr = normStr(r._remittance?.utr) || '-'

                    return (
                      <tr key={r.id}>
                        <td title={toDateStr(r.created_at)}>{toDateStr(r.created_at)}</td>
                        <td title={normStr(r.id)}>{shortOrderId(r.id)}</td>
                        <td>{r._channel}</td>
                        <td>
                          <div className="customer-box">
                            <span className="customer-name">{customer}</span>
                            {email ? <span className="customer-sub">{email}</span> : null}
                            {mobile ? <span className="customer-sub">{mobile}</span> : null}
                          </div>
                        </td>
                        <td title={awb}>{awb}</td>
                        <td>₹ {money(r._payable)}</td>
                        <td>
                          <span className={`status-pill ${statusPillClass(r._paymentType)}`}>
                            {displayStatus(r._paymentType)}
                          </span>
                        </td>
                        <td title={r._collectionPartner}>{r._collectionPartner}</td>
                        <td>
                          <span className={`status-pill ${statusPillClass(r._customerPaymentState)}`}>
                            {displayStatus(r._customerPaymentState)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${statusPillClass(r._bankSettlementState)}`}>
                            {displayStatus(r._bankSettlementState)}
                          </span>
                        </td>
                        <td title={r._bankDateText}>{r._bankDateText}</td>
                        <td title={utr}>{utr}</td>
                        <td>
                          <span className={`status-pill ${statusPillClass(orderStatus)}`}>
                            {displayStatus(orderStatus)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${statusPillClass(paymentStatus)}`}>
                            {displayStatus(paymentStatus)}
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
    </div>
  )
}