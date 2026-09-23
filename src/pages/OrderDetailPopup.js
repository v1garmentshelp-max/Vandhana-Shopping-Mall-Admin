import React, { useEffect, useMemo, useState } from 'react'
import './OrderDetailPopup.css'
import OrderShippingPanel from './OrderShippingPanel'
import { useAuth } from './AdminAuth'

const safeText = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

const parseMaybeJson = (value) => {
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

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN')
}

const formatDateOnly = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })
}

const formatLongDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  })
}

const getAddressLine = (address, key1, key2) => {
  if (!address || typeof address !== 'object') return ''
  return address[key1] || address[key2] || ''
}

const formatAddress = (address) => {
  const a = parseMaybeJson(address)
  if (!a) return '-'
  if (typeof a === 'string') return a

  const line1 = a.line1 || a.address_line1 || a.address1 || a.billing_address || ''
  const line2 = a.line2 || a.address_line2 || a.address2 || a.billing_address_2 || ''
  const landmark = a.landmark || ''
  const city = a.city || a.billing_city || ''
  const state = a.state || a.billing_state || ''
  const pincode = a.pincode || a.pin_code || a.billing_pincode || ''
  const country = a.country || a.billing_country || ''

  return [line1, line2, landmark, city, state, pincode, country].filter(Boolean).join(', ') || '-'
}

const normalizeTotals = (sale) => {
  const totals = parseMaybeJson(sale?.totals) || {}
  const total = Number(sale?.total || 0)
  const payable = Number(totals.payable ?? totals.total ?? total ?? 0)
  const bagTotal = Number(totals.bagTotal ?? totals.subtotal ?? totals.mrpTotal ?? payable ?? 0)
  const discountTotal = Number(totals.discountTotal ?? totals.discount ?? 0)
  const couponDiscount = Number(totals.couponDiscount ?? 0)
  const shipping = Number(totals.shipping ?? totals.convenience ?? 0)
  const giftWrap = Number(totals.giftWrap ?? 0)

  return {
    ...totals,
    bagTotal,
    discountTotal,
    couponDiscount,
    shipping,
    giftWrap,
    payable
  }
}

const getItemName = (item) => {
  return (
    item?.product_name ||
    item?.name ||
    item?.title ||
    item?.product_title ||
    item?.brand_name ||
    `Variant #${safeText(item?.variant_id)}`
  )
}

const getItemBrand = (item) => {
  return item?.brand_name || item?.brand || item?.brandName || ''
}

const getItemQty = (item) => {
  return Number(item?.qty ?? item?.quantity ?? 1) || 1
}

const getItemPrice = (item) => {
  return Number(item?.price ?? item?.selling_price ?? item?.final_price_b2c ?? 0) || 0
}

const getItemMrp = (item) => {
  const v = Number(item?.mrp ?? item?.original_price ?? item?.original_price_b2c ?? 0)
  return Number.isFinite(v) && v > 0 ? v : null
}

const getShipmentStatus = (shipment) => {
  return shipment?.status || shipment?.shipment_status || shipment?.current_status || '-'
}

const safeUpper = (value) => String(value || '').trim().toUpperCase()

const asNum = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const pickValue = (...values) => {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
}

const latestObject = (arr) => {
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

const normalizeOrderStatus = (value) => {
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

const normalizeRemittanceStatus = (value) => {
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

const getPayable = (sale) => {
  const totals = parseMaybeJson(sale?.totals) || {}
  return asNum(totals.payable ?? totals.total ?? totals.subtotal ?? totals.bagTotal ?? sale?.total ?? 0)
}

const getRemittance = (sale, detail, transactionDetail) => {
  const fromArray =
    latestObject(transactionDetail?.cod_remittances) ||
    latestObject(detail?.cod_remittances) ||
    latestObject(sale?.cod_remittances) ||
    latestObject(transactionDetail?.remittances) ||
    latestObject(sale?.remittances)

  const obj =
    fromArray ||
    transactionDetail?.latest_cod_remittance ||
    detail?.latest_cod_remittance ||
    sale?.latest_cod_remittance ||
    sale?.cod_remittance ||
    sale?.remittance ||
    {}

  return {
    status: pickValue(
      obj.remittance_status,
      obj.status,
      transactionDetail?.remittance_status,
      transactionDetail?.cod_remittance_status,
      detail?.remittance_status,
      sale?.remittance_status,
      sale?.cod_remittance_status
    ),
    utr: pickValue(
      obj.remittance_utr,
      obj.utr,
      obj.utr_number,
      obj.transaction_reference,
      transactionDetail?.remittance_utr,
      sale?.remittance_utr
    ),
    date: pickValue(
      obj.remittance_date,
      obj.settlement_date,
      obj.payment_date,
      obj.received_at,
      transactionDetail?.remittance_date,
      sale?.remittance_date
    ),
    scheduledFrom: pickValue(
      obj.remittance_scheduled_from,
      obj.scheduled_from,
      transactionDetail?.remittance_scheduled_from,
      sale?.remittance_scheduled_from
    ),
    scheduledTo: pickValue(
      obj.remittance_scheduled_to,
      obj.scheduled_to,
      transactionDetail?.remittance_scheduled_to,
      sale?.remittance_scheduled_to
    ),
    amount: pickValue(
      obj.cod_amount,
      obj.amount,
      obj.remittance_amount,
      transactionDetail?.cod_amount,
      sale?.cod_amount
    ),
    awb: pickValue(
      obj.awb,
      transactionDetail?.awb,
      transactionDetail?.latest_shipment?.awb,
      sale?.awb,
      sale?.latest_shipment?.awb
    ),
    shiprocketOrderId: pickValue(
      obj.shiprocket_order_id,
      transactionDetail?.shiprocket_order_id,
      transactionDetail?.latest_shipment?.shiprocket_order_id,
      sale?.shiprocket_order_id
    ),
    shiprocketShipmentId: pickValue(
      obj.shiprocket_shipment_id,
      transactionDetail?.shiprocket_shipment_id,
      transactionDetail?.latest_shipment?.shiprocket_shipment_id,
      sale?.shiprocket_shipment_id
    )
  }
}

const getBankDateText = (remittance, bankSettlementState) => {
  if (bankSettlementState === 'RECEIVED' && remittance.date) {
    return formatDateOnly(remittance.date)
  }

  if (bankSettlementState === 'SCHEDULED') {
    const from = formatDateOnly(remittance.scheduledFrom)
    const to = formatDateOnly(remittance.scheduledTo)

    if (from !== '-' && to !== '-') return `${from} to ${to}`
    if (to !== '-') return `Expected by ${to}`
    if (from !== '-') return `From ${from}`

    return 'Scheduled'
  }

  if (bankSettlementState === 'NOT_RECEIVED') return 'Not received'
  if (bankSettlementState === 'PENDING') return 'Pending'
  if (bankSettlementState === 'FAILED') return 'Failed'
  if (bankSettlementState === 'ON_HOLD') return 'On hold'
  if (bankSettlementState === 'NA') return '-'

  return '-'
}

const derivePaymentMeta = (sale, detail, transactionDetail, latestShipment) => {
  const paymentStatus = safeUpper(sale?.payment_status)
  const paymentMethod = safeUpper(sale?.payment_method)
  const paymentRef = safeText(sale?.payment_ref, '')
  const source = safeUpper(sale?.source) || 'WEB'
  const orderStatus = normalizeOrderStatus(sale?.effective_status || sale?.status || latestShipment?.status)
  const remittance = getRemittance(sale, detail, transactionDetail)
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

  const remittanceAmount = asNum(remittance.amount) || getPayable(sale)

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

const settlementPillClass = (value) => {
  const s = safeUpper(value)

  if (s === 'RECEIVED' || s === 'COLLECTED' || s === 'DELIVERED') return 'ok'
  if (s === 'SCHEDULED' || s === 'PENDING' || s === 'COD_PENDING' || s === 'ON_HOLD') return 'warn'
  if (s === 'NOT_RECEIVED' || s === 'NOT_COLLECTED' || s === 'FAILED' || s === 'CANCELLED' || s === 'RTO') return 'danger'
  if (s === 'NA') return 'muted'

  return 'info'
}

const displayStatus = (value) => {
  const s = safeUpper(value)
  if (!s) return '-'
  if (s === 'NA') return 'N/A'
  return s
}

export default function OrderDetailPopup({
  open,
  loading,
  detail,
  onClose,
  apiBase,
  orderSteps,
  statusText,
  computeStepFromLocal,
  computeStepFromShiprocket,
  computeStepFromShipment,
  buildExpectedDeliveryText,
  fmt
}) {
  const { token } = useAuth()

  const money = (value) => {
    if (typeof fmt === 'function') return fmt(value)
    return `₹${Number(value || 0).toFixed(2)}`
  }

  const getStatusText = (value) => {
    if (typeof statusText === 'function') return statusText(value)
    return String(value || '').toUpperCase()
  }

  const getLocalStep = (value) => {
    if (typeof computeStepFromLocal === 'function') return computeStepFromLocal(value)
    const steps = Array.isArray(orderSteps) && orderSteps.length ? orderSteps : ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']
    const idx = steps.indexOf(value || 'PLACED')
    return idx === -1 ? 0 : idx
  }

  const getShiprocketStep = (value) => {
    if (typeof computeStepFromShiprocket === 'function') return computeStepFromShiprocket(value)
    return 0
  }

  const getShipmentStep = (shipment, core) => {
    if (typeof computeStepFromShipment === 'function') return computeStepFromShipment(shipment, core)
    return 0
  }

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const [localShipment, setLocalShipment] = useState(null)

  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionError, setTransactionError] = useState('')
  const [transactionDetail, setTransactionDetail] = useState(null)

  const baseSale = detail?.sale || null
  const mergedSale = transactionDetail && baseSale && String(transactionDetail.id || transactionDetail.sale_id) === String(baseSale.id) ? { ...baseSale, ...transactionDetail } : baseSale
  const sale = mergedSale || baseSale
  const items = Array.isArray(detail?.items) ? detail.items : []
  const shipmentsFromDetail = Array.isArray(detail?.shipments) ? detail.shipments : []
  const shipmentsFromTransaction = transactionDetail?.latest_shipment ? [transactionDetail.latest_shipment] : []
  const baseShipments = shipmentsFromDetail.length ? shipmentsFromDetail : shipmentsFromTransaction
  const shipments = localShipment ? [localShipment, ...baseShipments.filter(s => s.id !== localShipment.id)] : baseShipments
  const saleTotals = normalizeTotals(sale)
  const shippingAddress = parseMaybeJson(sale?.shipping_address)

  const trackingSnapshot =
    detail?.trackingSnapshot ||
    {
      status: '',
      eddText: null,
      lastEventText: null,
      core: null
    }

  const latestShipmentFromDetail =
    transactionDetail?.latest_shipment ||
    detail?.latestShipment ||
    (shipments.length ? shipments[shipments.length - 1] : null)

  const latestShipment = localShipment || latestShipmentFromDetail

  const paymentMeta = useMemo(() => {
    return derivePaymentMeta(sale, detail, transactionDetail, latestShipment)
  }, [sale, detail, transactionDetail, latestShipment])

  const localOrderStatus = sale ? getStatusText(sale.status || 'PLACED') : ''
  const isCancelled = localOrderStatus === 'CANCELLED'

  const shiprocketStatus = getStatusText(trackingSnapshot.status)
  const shipmentStepIndex = getShipmentStep(latestShipment, trackingSnapshot.core)
  const baseLocalStep = getLocalStep(localOrderStatus)
  const baseShiprocketStep = getShiprocketStep(shiprocketStatus)

  const effectiveStepIndex = sale ? Math.max(baseLocalStep, baseShiprocketStep, shipmentStepIndex) : 0
  const steps = Array.isArray(orderSteps) && orderSteps.length ? orderSteps : ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']

  const placedText = sale?.created_at ? formatDateTime(sale.created_at) : '-'
  const expectedDelivery =
    sale && typeof buildExpectedDeliveryText === 'function'
      ? buildExpectedDeliveryText(trackingSnapshot, sale, latestShipment)
      : formatLongDate(sale?.created_at)

  const lastUpdateTime = (() => {
    if (!detail) return '-'
    if (trackingSnapshot.lastEventText) return trackingSnapshot.lastEventText
    const fallbackTime = latestShipment?.updated_at || latestShipment?.created_at || sale?.updated_at || sale?.created_at
    return formatDateTime(fallbackTime)
  })()

  const shipmentId = latestShipment?.shipment_id || latestShipment?.shiprocket_shipment_id || null
  const shiprocketOrderId = latestShipment?.shiprocket_order_id || latestShipment?.order_id || null

  const tryFetchJson = async (url, options) => {
    const res = await fetch(url, options)
    const txt = await res.text().catch(() => '')
    let json = null

    try {
      json = txt ? JSON.parse(txt) : null
    } catch {
      json = null
    }

    return { res, json, text: txt }
  }

  const codValue = String(sale?.payment_method || sale?.payment_status || '').toUpperCase() === 'COD'

  useEffect(() => {
    setLocalShipment(null)
    setTransactionDetail(null)
  }, [baseSale?.id])

  useEffect(() => {
    if (!open) {
      setLocalShipment(null)
      setTransactionLoading(false)
      setTransactionError('')
      setTransactionDetail(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !baseSale?.id || !apiBase) return

    let cancelled = false

    const run = async () => {
      setTransactionLoading(true)
      setTransactionError('')

      try {
        const { res, json } = await tryFetchJson(`${apiBase}/api/transactions/admin/${baseSale.id}`, {
          headers: { ...authHeaders }
        })

        if (cancelled) return

        if (res.ok && json) {
          setTransactionDetail(json)
        } else {
          setTransactionError(json?.message || 'Unable to load COD settlement details.')
        }
      } catch (e) {
        if (!cancelled) setTransactionError('Unable to load COD settlement details.')
      } finally {
        if (!cancelled) setTransactionLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [open, baseSale?.id, apiBase, authHeaders])

  const stop = (e) => e.stopPropagation()

  if (!open) return null

  const customerName = sale?.customer_name || sale?.customer?.name || '-'
  const customerMobile = sale?.customer_mobile || sale?.customer?.mobile || '-'
  const customerEmail = sale?.customer_email || sale?.customer?.email || '-'
  const paymentStatus = safeText(sale?.payment_status || 'COD').toUpperCase()
  const paymentMethod = safeText(sale?.payment_method || paymentStatus).toUpperCase()
  const isCodOrder = paymentMeta.paymentType === 'COD'

  return (
    <div className="odp-modal-backdrop" onClick={onClose}>
      <div className="odp-modal-panel" onClick={stop}>
        {loading ? (
          <div className="odp-loader">
            <div className="odp-spinner" />
            <span className="odp-loader-text">Loading order details</span>
          </div>
        ) : !detail || !sale ? (
          <div className="odp-empty-state">
            <div className="odp-empty-icon" />
            <h3 className="odp-empty-title">Unable to load order</h3>
            <p className="odp-empty-text">Please refresh and try again.</p>
            <button className="odp-btn odp-btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="odp-header">
              <div className="odp-header-main">
                <span className="odp-badge">Order Fulfilment</span>
                <h3 className="odp-title">Order #{sale?.id}</h3>
                <p className="odp-subtitle">Placed on {placedText}</p>
              </div>
              <div className="odp-header-actions">
                <span className={`odp-status-pill odp-status-${String(sale?.status || '').toLowerCase()}`}>
                  {localOrderStatus || '-'}
                </span>
                <button className="odp-btn odp-btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>

            <div className="odp-hero-card">
              <div className="odp-hero-left">
                <div className="odp-section-title">Order summary</div>
                <div className="odp-hero-sub">
                  {items.length} item{items.length === 1 ? '' : 's'} · {paymentStatus} · {money(saleTotals.payable)}
                </div>
                <div className="odp-chip-row">
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">Expected delivery</span>
                    <span className="odp-chip-value">{expectedDelivery}</span>
                  </div>
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">Last update</span>
                    <span className="odp-chip-value">{lastUpdateTime}</span>
                  </div>
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">Customer payment</span>
                    <span className={`odp-mini-pill odp-mini-${settlementPillClass(paymentMeta.customerPaymentState)}`}>
                      {displayStatus(paymentMeta.customerPaymentState)}
                    </span>
                  </div>
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">Bank settlement</span>
                    <span className={`odp-mini-pill odp-mini-${settlementPillClass(paymentMeta.bankSettlementState)}`}>
                      {displayStatus(paymentMeta.bankSettlementState)}
                    </span>
                  </div>
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">Bank date</span>
                    <span className="odp-chip-value">{paymentMeta.bankDateText}</span>
                  </div>
                  <div className="odp-chip-box">
                    <span className="odp-chip-label">COD</span>
                    <span className="odp-chip-value">{codValue ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              <div className="odp-hero-right">
                <p>Use “Ship this order” below to connect the order, generate AWB and request pickup.</p>
              </div>
            </div>

            <div className="odp-progress-card">
              <div className="odp-progress-head">
                <div>
                  <div className="odp-section-title">Fulfilment progress</div>
                  <div className="odp-section-sub">Status across order, shipment, and Shiprocket</div>
                </div>
                <div className="odp-progress-pill">
                  {isCancelled
                    ? 'Order cancelled'
                    : effectiveStepIndex === steps.length - 1
                      ? 'Delivered to customer'
                      : `Currently ${String(steps[effectiveStepIndex] || 'placed').toLowerCase()}`}
                </div>
              </div>

              <div className={`odp-timeline ${isCancelled ? 'cancelled' : ''}`}>
                <div className="odp-timeline-line" />
                <div className="odp-timeline-steps">
                  {steps.map((step, index) => {
                    const stepState =
                      isCancelled && step !== 'PLACED'
                        ? 'upcoming'
                        : index < effectiveStepIndex
                          ? 'done'
                          : index === effectiveStepIndex
                            ? 'active'
                            : 'upcoming'

                    return (
                      <div className="odp-timeline-step" key={step}>
                        <div className={`odp-timeline-dot odp-timeline-dot-${stepState}`} />
                        <div className="odp-timeline-label">{step}</div>
                        <div className="odp-timeline-caption">
                          {step === 'PLACED' && 'Order captured'}
                          {step === 'CONFIRMED' && 'Verified'}
                          {step === 'PACKED' && 'Packed'}
                          {step === 'SHIPPED' && 'Out for delivery'}
                          {step === 'DELIVERED' && 'Delivered'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="odp-progress-grid">
                <div className="odp-progress-item">
                  <span className="odp-progress-label">AWB</span>
                  <span className="odp-progress-value">{latestShipment?.awb || '-'}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Shipment ID</span>
                  <span className="odp-progress-value">{shipmentId || '-'}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Shiprocket Order</span>
                  <span className="odp-progress-value">{shiprocketOrderId || '-'}</span>
                </div>
              </div>
            </div>

            <div className="odp-step-card">
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">COD and bank settlement</div>
                  <div className="odp-step-card-sub">Customer payment is different from Shiprocket bank settlement</div>
                </div>
                {transactionLoading ? <div className="odp-progress-pill">Loading settlement</div> : null}
              </div>

              {transactionError ? <div className="odp-alert odp-alert-error">{transactionError}</div> : null}

              <div className="odp-settlement-grid">
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Payment type</span>
                  <span className={`odp-mini-pill odp-mini-${settlementPillClass(paymentMeta.paymentType)}`}>
                    {displayStatus(paymentMeta.paymentType)}
                  </span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Collection partner</span>
                  <span className="odp-progress-value">{paymentMeta.collectionPartner}</span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Customer payment</span>
                  <span className={`odp-mini-pill odp-mini-${settlementPillClass(paymentMeta.customerPaymentState)}`}>
                    {displayStatus(paymentMeta.customerPaymentState)}
                  </span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Shiprocket bank settlement</span>
                  <span className={`odp-mini-pill odp-mini-${settlementPillClass(paymentMeta.bankSettlementState)}`}>
                    {displayStatus(paymentMeta.bankSettlementState)}
                  </span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Expected / received bank date</span>
                  <span className="odp-progress-value">{paymentMeta.bankDateText}</span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">COD amount</span>
                  <span className="odp-progress-value">{isCodOrder ? money(paymentMeta.remittanceAmount) : '-'}</span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">UTR</span>
                  <span className="odp-progress-value">{paymentMeta.remittance.utr || '-'}</span>
                </div>
                <div className="odp-settlement-card">
                  <span className="odp-progress-label">Remittance AWB</span>
                  <span className="odp-progress-value">{paymentMeta.remittance.awb || latestShipment?.awb || '-'}</span>
                </div>
              </div>
            </div>

            <div className="odp-step-card">
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Customer details</div>
                  <div className="odp-step-card-sub">Buyer, payment, branch, and address information</div>
                </div>
              </div>

              <div className="odp-progress-grid">
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Customer name</span>
                  <span className="odp-progress-value">{customerName}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Mobile</span>
                  <span className="odp-progress-value">{customerMobile}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Email</span>
                  <span className="odp-progress-value">{customerEmail}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Branch ID</span>
                  <span className="odp-progress-value">{safeText(sale?.branch_id)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Source</span>
                  <span className="odp-progress-value">{safeText(sale?.source)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Payment method</span>
                  <span className="odp-progress-value">{paymentMethod}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Payment status</span>
                  <span className="odp-progress-value">{paymentStatus}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Payment reference</span>
                  <span className="odp-progress-value">{safeText(sale?.payment_ref)}</span>
                </div>
              </div>

              <div className="odp-address-card">
                <div className="odp-address-head">
                  <h4 className="odp-address-title">Shipping address</h4>
                  <span className="odp-address-tag">Delivery</span>
                </div>
                <div className="odp-address-body">
                  <p>{formatAddress(shippingAddress)}</p>
                  <p>
                    {[
                      getAddressLine(shippingAddress, 'city', 'billing_city'),
                      getAddressLine(shippingAddress, 'state', 'billing_state'),
                      getAddressLine(shippingAddress, 'pincode', 'billing_pincode')
                    ]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="odp-step-card">
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Payment breakdown</div>
                  <div className="odp-step-card-sub">Complete amount details from the order</div>
                </div>
              </div>

              <div className="odp-payment-box">
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Bag total</span>
                  <span className="odp-pay-v">{money(saleTotals.bagTotal)}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Discount</span>
                  <span className="odp-pay-v">{money(saleTotals.discountTotal)}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Coupon discount</span>
                  <span className="odp-pay-v">{money(saleTotals.couponDiscount)}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Shipping / convenience</span>
                  <span className="odp-pay-v">{money(saleTotals.shipping)}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Gift wrap</span>
                  <span className="odp-pay-v">{money(saleTotals.giftWrap)}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Payable</span>
                  <span className="odp-pay-v">{money(saleTotals.payable)}</span>
                </div>
              </div>
            </div>

            <OrderShippingPanel key={sale.id} saleId={sale.id} apiBase={apiBase} token={token} onShipment={setLocalShipment} />

            <div className="odp-step-card">
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Shipment records</div>
                  <div className="odp-step-card-sub">All shipment rows linked to this order</div>
                </div>
              </div>

              {shipments.length ? (
                <div className="odp-shipment-grid">
                  {shipments.map((sh, index) => (
                    <div className="odp-shipment-card" key={`${sh.id || sh.shiprocket_shipment_id || index}`}>
                      <div className="odp-progress-grid">
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Shipment row</span>
                          <span className="odp-progress-value">{safeText(sh.id || index + 1)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Branch</span>
                          <span className="odp-progress-value">{safeText(sh.branch_id)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Shiprocket shipment</span>
                          <span className="odp-progress-value">{safeText(sh.shiprocket_shipment_id || sh.shipment_id)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Shiprocket order</span>
                          <span className="odp-progress-value">{safeText(sh.shiprocket_order_id)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">AWB</span>
                          <span className="odp-progress-value">{safeText(sh.awb)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Status</span>
                          <span className="odp-progress-value">{getShipmentStatus(sh)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Created</span>
                          <span className="odp-progress-value">{formatDateTime(sh.created_at)}</span>
                        </div>
                        <div className="odp-progress-item">
                          <span className="odp-progress-label">Updated</span>
                          <span className="odp-progress-value">{formatDateTime(sh.updated_at)}</span>
                        </div>
                      </div>
                      <div className="odp-payment-actions">
                        {sh.label_url ? (
                          <a className="odp-btn odp-btn-ghost" href={sh.label_url} target="_blank" rel="noopener noreferrer">
                            Label
                          </a>
                        ) : null}
                        {sh.tracking_url ? (
                          <a className="odp-btn odp-btn-ghost" href={sh.tracking_url} target="_blank" rel="noopener noreferrer">
                            Tracking
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="odp-empty">No shipment records found for this order.</div>
              )}
            </div>

            <div className="odp-items-head">
              <div>
                <p className="odp-items-title">Items in this order</p>
                <p className="odp-items-subtitle">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="odp-items-grid">
              {items.length ? (
                items.map((it, i) => {
                  const qty = getItemQty(it)
                  const price = getItemPrice(it)
                  const mrp = getItemMrp(it)
                  const subtotal = qty * price

                  return (
                    <div className="odp-item-card" key={`${it.variant_id || it.product_id || i}-${i}`}>
                      <div className="odp-item-media">
                        {it.image_url ? <img src={it.image_url} alt={getItemName(it)} /> : <div className="odp-item-placeholder" />}
                      </div>
                      <div className="odp-item-main">
                        <div className="odp-item-top">
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Product</span>
                            <span className="odp-item-value">{getItemName(it)}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Brand</span>
                            <span className="odp-item-value">{getItemBrand(it) || '-'}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Product ID</span>
                            <span className="odp-item-value">{safeText(it.product_id)}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Variant</span>
                            <span className="odp-item-value">#{safeText(it.variant_id)}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Size</span>
                            <span className="odp-item-value">{it.size || it.selected_size || '-'}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">Colour</span>
                            <span className="odp-item-value">{it.colour || it.color || it.selected_color || '-'}</span>
                          </div>
                          <div className="odp-item-meta">
                            <span className="odp-item-label">EAN</span>
                            <span className="odp-item-value muted">{it.ean_code || it.barcode_value || '-'}</span>
                          </div>
                        </div>
                        <div className="odp-item-pricing">
                          <div className="odp-item-qty">Qty {qty}</div>
                          <div className="odp-item-price">{money(price)}</div>
                          {mrp != null ? <div className="odp-item-mrp">MRP {money(mrp)}</div> : null}
                          <div className="odp-item-price">Subtotal {money(subtotal)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="odp-empty-inline">No items in this order</div>
              )}
            </div>

            <div className="odp-step-card">
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Additional order data</div>
                  <div className="odp-step-card-sub">System fields available for this sale</div>
                </div>
              </div>

              <div className="odp-progress-grid">
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Order ID</span>
                  <span className="odp-progress-value">{safeText(sale?.id)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Status</span>
                  <span className="odp-progress-value">{safeText(sale?.status)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Payment status</span>
                  <span className="odp-progress-value">{safeText(sale?.payment_status)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Payment method</span>
                  <span className="odp-progress-value">{safeText(sale?.payment_method)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Bank settlement</span>
                  <span className="odp-progress-value">{displayStatus(paymentMeta.bankSettlementState)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Bank date</span>
                  <span className="odp-progress-value">{paymentMeta.bankDateText}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Created at</span>
                  <span className="odp-progress-value">{formatDateTime(sale?.created_at)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Updated at</span>
                  <span className="odp-progress-value">{formatDateTime(sale?.updated_at)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Cancellation reason</span>
                  <span className="odp-progress-value">{safeText(sale?.cancellation_reason)}</span>
                </div>
                <div className="odp-progress-item">
                  <span className="odp-progress-label">Cancellation payment type</span>
                  <span className="odp-progress-value">{safeText(sale?.cancellation_payment_type)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}