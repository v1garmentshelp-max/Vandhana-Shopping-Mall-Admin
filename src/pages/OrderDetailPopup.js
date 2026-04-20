import React, { useEffect, useMemo, useState } from 'react'
import './OrderDetailPopup.css'
import { useAuth } from './AdminAuth'

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

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const [courierLoading, setCourierLoading] = useState(false)
  const [courierError, setCourierError] = useState('')
  const [courierData, setCourierData] = useState(null)
  const [selectedCourierId, setSelectedCourierId] = useState(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')
  const [walletMessage, setWalletMessage] = useState('')

  const [localShipment, setLocalShipment] = useState(null)

  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [trackingData, setTrackingData] = useState(null)

  const sale = detail?.sale || null
  const items = Array.isArray(detail?.items) ? detail.items : []
  const shipments = Array.isArray(detail?.shipments) ? detail.shipments : []
  const trackingSnapshot =
    detail?.trackingSnapshot ||
    {
      status: '',
      eddText: null,
      lastEventText: null,
      core: null
    }

  const latestShipmentFromDetail = detail?.latestShipment || (shipments.length ? shipments[shipments.length - 1] : null)
  const latestShipment = localShipment || latestShipmentFromDetail

  const localOrderStatus = sale ? statusText(sale.status || 'PLACED') : ''
  const isCancelled = localOrderStatus === 'CANCELLED'

  const shiprocketStatus = statusText(trackingSnapshot.status)
  const shipmentStepIndex = computeStepFromShipment(latestShipment, trackingSnapshot.core)
  const baseLocalStep = computeStepFromLocal(localOrderStatus)
  const baseShiprocketStep = computeStepFromShiprocket(shiprocketStatus)

  const effectiveStepIndex = sale ? Math.max(baseLocalStep, baseShiprocketStep, shipmentStepIndex) : 0

  const placedText = sale?.created_at ? new Date(sale.created_at).toLocaleString('en-IN') : '-'
  const expectedDelivery = sale ? buildExpectedDeliveryText(trackingSnapshot, sale, latestShipment) : '-'

  const lastUpdateTime = (() => {
    if (!detail) return '-'
    if (trackingSnapshot.lastEventText) return trackingSnapshot.lastEventText
    const fallbackTime = latestShipment?.updated_at || latestShipment?.created_at || sale?.updated_at || sale?.created_at
    if (!fallbackTime) return '-'
    const t = new Date(fallbackTime)
    if (Number.isNaN(t.getTime())) return '-'
    return t.toLocaleString('en-IN')
  })()

  const hasAwb = !!latestShipment?.awb
  const shipmentId = latestShipment?.shipment_id || latestShipment?.shiprocket_shipment_id || null
  const shiprocketOrderId = latestShipment?.shiprocket_order_id || latestShipment?.order_id || null

  const srData = useMemo(() => {
    return courierData?.data?.data || courierData?.data || courierData || null
  }, [courierData])

  const availableCouriers = useMemo(() => {
    return Array.isArray(srData?.available_courier_companies) ? srData.available_courier_companies : []
  }, [srData])

  const recommendedCourierCompanyId = useMemo(() => {
    return srData?.recommended_courier_company_id || srData?.shiprocket_recommended_courier_id || null
  }, [srData])

  const codValue = useMemo(() => {
    return typeof srData?.cod === 'boolean' ? srData.cod : typeof courierData?.cod === 'boolean' ? courierData.cod : false
  }, [srData, courierData])

  useEffect(() => {
    if (!open) {
      setCourierLoading(false)
      setCourierError('')
      setCourierData(null)
      setSelectedCourierId(null)
      setActionLoading(false)
      setActionError('')
      setActionOk('')
      setWalletMessage('')
      setLocalShipment(null)
      setTrackingLoading(false)
      setTrackingError('')
      setTrackingData(null)
    }
  }, [open])

  useEffect(() => {
    if (!courierData) return
    const initial =
      selectedCourierId ||
      recommendedCourierCompanyId ||
      (availableCouriers.length ? availableCouriers[0]?.courier_company_id : null)

    if (initial) setSelectedCourierId(initial)
  }, [courierData, selectedCourierId, recommendedCourierCompanyId, availableCouriers])

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

  const loadServiceability = async () => {
    if (!sale?.id) return
    setCourierLoading(true)
    setCourierError('')
    setCourierData(null)
    setSelectedCourierId(null)
    setActionOk('')
    setActionError('')
    setWalletMessage('')
    try {
      const candidates = [
        { url: `${apiBase}/api/shiprocket/serviceability/by-sale/${sale.id}`, opts: { headers: { ...authHeaders } } },
        { url: `${apiBase}/api/shiprocket/serviceability/sale/${sale.id}`, opts: { headers: { ...authHeaders } } },
        { url: `${apiBase}/api/shiprocket/serviceability/${sale.id}`, opts: { headers: { ...authHeaders } } }
      ]

      let ok = false
      let payload = null

      for (const c of candidates) {
        try {
          const { res, json } = await tryFetchJson(c.url, c.opts)
          if (res.ok && json) {
            ok = true
            payload = json
            break
          }
        } catch {
          ok = false
        }
      }

      if (!ok) {
        setCourierError('Could not fetch courier options for this order.')
        return
      }

      setCourierData(payload)
    } finally {
      setCourierLoading(false)
    }
  }

  const shiprocketWalletUrl = 'https://app.shiprocket.in/dashboard/settings/wallet'

  const parseAwbFromAssignResponse = (payload) => {
    const data = payload?.data || payload?.result || payload || null
    const statusCode = Number(data?.status_code || payload?.status_code || 0)
    const msg = data?.message || payload?.message || ''
    const awbAssignStatus =
      data?.awb_assign_status != null
        ? Number(data.awb_assign_status)
        : data?.response?.awb_assign_status != null
          ? Number(data.response.awb_assign_status)
          : null

    const possibleAwb =
      payload?.awb ||
      payload?.data?.awb ||
      payload?.result?.awb ||
      payload?.result?.data?.awb ||
      payload?.data?.data?.awb ||
      payload?.shipment?.awb ||
      null

    const errorFromSr =
      data?.response?.data?.awb_assign_error ||
      data?.response?.awb_assign_error ||
      data?.awb_assign_error ||
      payload?.awb_assign_error ||
      ''

    const isWalletLow = statusCode === 350 || /recharge/i.test(String(msg)) || /recharge/i.test(String(errorFromSr))
    const isSuccess = !!possibleAwb || awbAssignStatus === 1 || statusCode === 200

    return { statusCode, msg, isWalletLow, isSuccess, possibleAwb, errorFromSr }
  }

  const assignCourierAndGenerateAwb = async () => {
    if (!sale?.id) return
    if (!selectedCourierId) {
      setActionError('Please select a courier partner.')
      return
    }

    setActionLoading(true)
    setActionError('')
    setActionOk('')
    setWalletMessage('')

    try {
      const body = { sale_id: sale.id, courier_company_id: Number(selectedCourierId) }

      const candidates = [
        {
          url: `${apiBase}/api/shiprocket/assign-courier`,
          opts: { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify(body) }
        },
        {
          url: `${apiBase}/api/shiprocket/assign-awb`,
          opts: { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify(body) }
        },
        {
          url: `${apiBase}/api/shiprocket/assign-courier/by-sale/${sale.id}`,
          opts: { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ courier_company_id: Number(selectedCourierId) }) }
        }
      ]

      let payload = null
      let lastJson = null

      for (const c of candidates) {
        try {
          const { res, json } = await tryFetchJson(c.url, c.opts)
          lastJson = json
          if (json) {
            payload = json
            if (res.ok) break
          }
        } catch {
          payload = null
        }
      }

      if (!payload) {
        setActionError('Could not process Shiprocket request.')
        return
      }

      if (payload?.ok === false) {
        const m = payload?.message || 'Shiprocket request failed.'
        setActionError(m)
        if (/recharge/i.test(m)) setWalletMessage(m)
        return
      }

      const parsed = parseAwbFromAssignResponse(payload)

      if (parsed.isWalletLow) {
        const m = parsed.errorFromSr || parsed.msg || 'Please recharge your Shiprocket wallet.'
        setWalletMessage(m)
        setActionError(m)
        return
      }

      if (!parsed.isSuccess) {
        const m = parsed.errorFromSr || parsed.msg || lastJson?.message || 'Unable to generate AWB.'
        setActionError(m)
        return
      }

      const nextShipment = {
        ...(latestShipment || {}),
        awb: parsed.possibleAwb || latestShipment?.awb,
        courier_name:
          payload?.courier_name ||
          payload?.data?.courier_name ||
          payload?.shipment?.courier_name ||
          latestShipment?.courier_name,
        courier_company_id:
          payload?.courier_company_id ||
          payload?.data?.courier_company_id ||
          payload?.shipment?.courier_company_id ||
          latestShipment?.courier_company_id,
        shiprocket_order_id:
          payload?.shiprocket_order_id ||
          payload?.data?.shiprocket_order_id ||
          payload?.shipment?.shiprocket_order_id ||
          latestShipment?.shiprocket_order_id,
        shipment_id:
          payload?.shipment_id ||
          payload?.data?.shipment_id ||
          payload?.shipment?.shipment_id ||
          latestShipment?.shipment_id,
        shiprocket_shipment_id:
          payload?.shiprocket_shipment_id ||
          payload?.data?.shiprocket_shipment_id ||
          payload?.shipment?.shiprocket_shipment_id ||
          latestShipment?.shiprocket_shipment_id,
        status: payload?.status || payload?.shipment_status || latestShipment?.status
      }

      setLocalShipment(nextShipment)
      setActionOk('AWB generated successfully.')
      setActionError('')
      setWalletMessage('')
    } finally {
      setActionLoading(false)
    }
  }

  const fetchTracking = async () => {
    if (!sale?.id) return
    setTrackingLoading(true)
    setTrackingError('')
    try {
      const { res, json } = await tryFetchJson(`${apiBase}/api/shiprocket/tracking/by-sale/${sale.id}`, { headers: { ...authHeaders } })
      if (!res.ok || !json) {
        setTrackingError(json?.message || 'Unable to fetch tracking.')
        return
      }
      if (json?.ok === false) {
        setTrackingError(json?.message || 'Unable to fetch tracking.')
        return
      }
      setTrackingData(json)
    } finally {
      setTrackingLoading(false)
    }
  }

  const stop = (e) => e.stopPropagation()

  if (!open) return null

  const courierSummary = (c) => {
    const price = c?.rate ?? c?.freight_charge ?? c?.cost ?? null
    const etd = c?.etd || null
    const days = c?.estimated_delivery_days || null
    const rating = c?.rating ?? null
    const mode = c?.is_surface ? 'Surface' : c?.mode === 0 ? 'Surface' : 'Air'
    return { price, etd, days, rating, mode }
  }

  const selectedCourier =
    availableCouriers.find((c) => Number(c.courier_company_id) === Number(selectedCourierId)) || null
  const selectedCourierMeta = selectedCourier ? courierSummary(selectedCourier) : null

  const step1Done = !!selectedCourierId
  const step2Done = !!hasAwb
  const step3Done = step2Done

  const trackingCore = trackingData?.data || trackingData?.tracking || trackingData || null
  const trackingEvents = Array.isArray(trackingCore?.tracking_data?.shipment_track_activities)
    ? trackingCore.tracking_data.shipment_track_activities
    : Array.isArray(trackingCore?.tracking_data?.shipment_track?.activities)
      ? trackingCore.tracking_data.shipment_track.activities
      : Array.isArray(trackingCore?.tracking_data?.track_status)
        ? trackingCore.tracking_data.track_status
        : []

  const trackingHeader = (() => {
    const td = trackingCore?.tracking_data || null
    const st = td?.shipment_track?.[0] || td?.shipment_track || null
    return {
      courier: st?.courier_name || latestShipment?.courier_name || '-',
      awb: st?.awb_code || latestShipment?.awb || '-',
      current: td?.shipment_track?.[0]?.current_status || td?.shipment_track?.current_status || td?.track_status || '-',
      pickupDate: td?.shipment_track?.[0]?.pickup_date || td?.shipment_track?.pickup_date || '-',
      deliveredDate: td?.shipment_track?.[0]?.delivered_date || td?.shipment_track?.delivered_date || '-'
    }
  })()

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
              <div>
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
                  {items.length} item{items.length === 1 ? '' : 's'} · {String(sale?.payment_status || 'COD').toUpperCase()} · {fmt(sale?.totals?.payable ?? sale?.total)}
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
                    <span className="odp-chip-label">COD</span>
                    <span className="odp-chip-value">{codValue ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              <div className="odp-hero-right">
                <div className="odp-stepper">
                  <div className={`odp-step ${step1Done ? 'done' : 'active'}`}>
                    <div className="odp-step-dot" />
                    <div className="odp-step-copy">
                      <div className="odp-step-title">Step 1</div>
                      <div className="odp-step-sub">Select courier partner</div>
                    </div>
                  </div>
                  <div className={`odp-step ${step2Done ? 'done' : step1Done ? 'active' : ''}`}>
                    <div className="odp-step-dot" />
                    <div className="odp-step-copy">
                      <div className="odp-step-title">Step 2</div>
                      <div className="odp-step-sub">Wallet payment and AWB</div>
                    </div>
                  </div>
                  <div className={`odp-step ${step3Done ? 'done' : step2Done ? 'active' : ''}`}>
                    <div className="odp-step-dot" />
                    <div className="odp-step-copy">
                      <div className="odp-step-title">Step 3</div>
                      <div className="odp-step-sub">Documents and tracking</div>
                    </div>
                  </div>
                </div>
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
                    : effectiveStepIndex === orderSteps.length - 1
                      ? 'Delivered to customer'
                      : `Currently ${orderSteps[effectiveStepIndex].toLowerCase()}`}
                </div>
              </div>

              <div className={`odp-timeline ${isCancelled ? 'cancelled' : ''}`}>
                <div className="odp-timeline-line" />
                <div className="odp-timeline-steps">
                  {orderSteps.map((step, index) => {
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
                  <div className="odp-step-card-title">Step 1: Select courier partner</div>
                  <div className="odp-step-card-sub">Fetch courier options for the delivery pincode and choose one</div>
                </div>
                <div className="odp-step-card-actions">
                  <button className="odp-btn odp-btn-primary" onClick={loadServiceability} disabled={courierLoading || actionLoading}>
                    {courierLoading ? 'Loading…' : 'Get courier options'}
                  </button>
                </div>
              </div>

              {courierError ? <div className="odp-alert odp-alert-error">{courierError}</div> : null}

              {courierData ? (
                <>
                  <div className="odp-courier-summary">
                    <div className="odp-summary-pill">
                      <span className="odp-summary-label">Recommended</span>
                      <span className="odp-summary-value">{recommendedCourierCompanyId ? `#${recommendedCourierCompanyId}` : '-'}</span>
                    </div>
                    <div className="odp-summary-pill">
                      <span className="odp-summary-label">Available</span>
                      <span className="odp-summary-value">{availableCouriers.length}</span>
                    </div>
                    <div className="odp-summary-pill">
                      <span className="odp-summary-label">COD</span>
                      <span className="odp-summary-value">{codValue ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  <div className="odp-courier-list">
                    {availableCouriers.length ? (
                      availableCouriers.map((c) => {
                        const meta = courierSummary(c)
                        const isSelected = Number(selectedCourierId) === Number(c.courier_company_id)
                        const isRecommended =
                          recommendedCourierCompanyId &&
                          Number(recommendedCourierCompanyId) === Number(c.courier_company_id)
                        return (
                          <button
                            key={String(c.id || c.courier_company_id)}
                            type="button"
                            className={`odp-courier-row ${isSelected ? 'odp-courier-row-selected' : ''}`}
                            onClick={() => setSelectedCourierId(Number(c.courier_company_id))}
                          >
                            <div className="odp-courier-left">
                              <div className="odp-courier-name">
                                <span className="odp-courier-radio" aria-hidden="true">
                                  <span className={`odp-courier-radio-dot ${isSelected ? 'on' : ''}`} />
                                </span>
                                <span>{c.courier_name || `Courier #${c.courier_company_id}`}</span>
                                {isRecommended ? <span className="odp-tag">Recommended</span> : null}
                                {c.blocked ? <span className="odp-tag odp-tag-danger">Blocked</span> : null}
                              </div>
                              <div className="odp-courier-meta">
                                <span>{meta.mode}</span>
                                {meta.days ? <span>· {meta.days} days</span> : null}
                                {meta.etd ? <span>· ETD {meta.etd}</span> : null}
                                {meta.rating ? <span>· ⭐ {meta.rating}</span> : null}
                              </div>
                            </div>
                            <div className="odp-courier-right">
                              <div className="odp-courier-price">
                                {meta.price != null && meta.price !== '' ? fmt(meta.price) : '-'}
                              </div>
                              <div className="odp-courier-id">#{c.courier_company_id}</div>
                            </div>
                          </button>
                        )
                      })
                    ) : (
                      <div className="odp-empty">No couriers returned for this order.</div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className={`odp-step-card ${!step1Done ? 'odp-step-card-disabled' : ''}`}>
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Step 2: Wallet payment and generate AWB</div>
                  <div className="odp-step-card-sub">Shiprocket charges from wallet during AWB generation. Recharge if balance is low.</div>
                </div>
              </div>

              {actionError ? <div className="odp-alert odp-alert-error">{actionError}</div> : null}

              {walletMessage ? (
                <div className="odp-wallet-row">
                  <div className="odp-wallet-left">
                    <div className="odp-wallet-title">Wallet attention needed</div>
                    <div className="odp-wallet-sub">{walletMessage}</div>
                  </div>
                  <div className="odp-wallet-actions">
                    <a className="odp-btn odp-btn-primary" href={shiprocketWalletUrl} target="_blank" rel="noopener noreferrer">
                      Recharge wallet
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="odp-payment-box">
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Selected courier</span>
                  <span className="odp-pay-v">{selectedCourier ? selectedCourier.courier_name : '-'}</span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Estimated shipping charge</span>
                  <span className="odp-pay-v">
                    {selectedCourierMeta?.price != null && selectedCourierMeta?.price !== '' ? fmt(selectedCourierMeta.price) : '-'}
                  </span>
                </div>
                <div className="odp-payment-line">
                  <span className="odp-pay-k">Payment mode</span>
                  <span className="odp-pay-v">Shiprocket wallet</span>
                </div>

                <div className="odp-payment-actions">
                  <button
                    className="odp-btn odp-btn-primary"
                    onClick={assignCourierAndGenerateAwb}
                    disabled={!step1Done || actionLoading || courierLoading}
                  >
                    {actionLoading ? 'Processing…' : 'Generate AWB'}
                  </button>
                  <a className="odp-btn odp-btn-ghost" href={shiprocketWalletUrl} target="_blank" rel="noopener noreferrer">
                    Open wallet
                  </a>
                </div>

                {actionOk ? <div className="odp-alert odp-alert-ok">{actionOk}</div> : null}
              </div>
            </div>

            <div className={`odp-step-card ${!hasAwb ? 'odp-step-card-disabled' : ''}`}>
              <div className="odp-step-card-head">
                <div>
                  <div className="odp-step-card-title">Step 3: Documents and tracking</div>
                  <div className="odp-step-card-sub">Documents become available only after AWB is generated</div>
                </div>
                <div className="odp-step-card-actions">
                  <button className="odp-btn odp-btn-primary" onClick={fetchTracking} disabled={!hasAwb || trackingLoading}>
                    {trackingLoading ? 'Refreshing…' : 'Refresh tracking'}
                  </button>
                </div>
              </div>

              {!hasAwb ? (
                <div className="odp-empty">Generate AWB to unlock label, invoice, manifest, and tracking.</div>
              ) : (
                <>
                  <div className="odp-docs-row">
                    <a href={`${apiBase}/api/shiprocket/label/${sale?.id}`} target="_blank" rel="noopener noreferrer" className="odp-btn odp-btn-ghost">
                      Download label
                    </a>
                    <a href={`${apiBase}/api/shiprocket/invoice/${sale?.id}`} target="_blank" rel="noopener noreferrer" className="odp-btn odp-btn-ghost">
                      Download tax invoice
                    </a>
                    <a href={`${apiBase}/api/shiprocket/manifest/${sale?.id}`} target="_blank" rel="noopener noreferrer" className="odp-btn odp-btn-ghost">
                      Download manifest
                    </a>
                  </div>

                  {trackingError ? <div className="odp-alert odp-alert-error">{trackingError}</div> : null}

                  <div className="odp-track-card">
                    <div className="odp-track-head">
                      <div className="odp-section-title">Live tracking (Shiprocket)</div>
                      <div className="odp-section-sub">Pickup, in transit, and delivery updates from Shiprocket</div>
                    </div>

                    <div className="odp-track-grid">
                      <div className="odp-track-item">
                        <div className="odp-track-k">Courier</div>
                        <div className="odp-track-v">{trackingHeader.courier}</div>
                      </div>
                      <div className="odp-track-item">
                        <div className="odp-track-k">AWB</div>
                        <div className="odp-track-v">{trackingHeader.awb}</div>
                      </div>
                      <div className="odp-track-item">
                        <div className="odp-track-k">Pickup</div>
                        <div className="odp-track-v">{trackingHeader.pickupDate}</div>
                      </div>
                      <div className="odp-track-item">
                        <div className="odp-track-k">Delivered</div>
                        <div className="odp-track-v">{trackingHeader.deliveredDate}</div>
                      </div>
                    </div>

                    <div className="odp-track-events">
                      {trackingEvents.length ? (
                        trackingEvents.slice(0, 20).map((ev, idx) => (
                          <div key={idx} className="odp-track-event">
                            <div className="odp-track-ev-time">{ev?.date || ev?.activity_date_time || ev?.datetime || '-'}</div>
                            <div className="odp-track-ev-text">{ev?.activity || ev?.status || ev?.remark || ev?.description || '-'}</div>
                            <div className="odp-track-ev-loc">{ev?.location || ev?.city || ev?.pickup_location || '-'}</div>
                          </div>
                        ))
                      ) : (
                        <div className="odp-empty">No tracking events yet. Try refresh after pickup is requested.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {sale?.shipping_address ? (
              <div className="odp-address-card">
                <div className="odp-address-head">
                  <h4 className="odp-address-title">Shipping address</h4>
                  <span className="odp-address-tag">Delivery</span>
                </div>
                <div className="odp-address-body">
                  <p>{sale.shipping_address.line1}</p>
                  {sale.shipping_address.line2 ? <p>{sale.shipping_address.line2}</p> : null}
                  <p>
                    {sale.shipping_address.city} {sale.shipping_address.state} - {sale.shipping_address.pincode}
                  </p>
                </div>
              </div>
            ) : null}

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
                items.map((it, i) => (
                  <div className="odp-item-card" key={`${it.variant_id}-${i}`}>
                    <div className="odp-item-media">
                      {it.image_url ? <img src={it.image_url} alt="" /> : <div className="odp-item-placeholder" />}
                    </div>
                    <div className="odp-item-main">
                      <div className="odp-item-top">
                        <div className="odp-item-meta">
                          <span className="odp-item-label">Variant</span>
                          <span className="odp-item-value">#{it.variant_id}</span>
                        </div>
                        <div className="odp-item-meta">
                          <span className="odp-item-label">Size</span>
                          <span className="odp-item-value">{it.size || '-'}</span>
                        </div>
                        <div className="odp-item-meta">
                          <span className="odp-item-label">Colour</span>
                          <span className="odp-item-value">{it.colour || '-'}</span>
                        </div>
                        <div className="odp-item-meta">
                          <span className="odp-item-label">EAN</span>
                          <span className="odp-item-value muted">{it.ean_code || '-'}</span>
                        </div>
                      </div>
                      <div className="odp-item-pricing">
                        <div className="odp-item-qty">x{it.qty}</div>
                        <div className="odp-item-price">{fmt(it.price)}</div>
                        {it.mrp != null && Number(it.mrp) > 0 ? <div className="odp-item-mrp">MRP {fmt(it.mrp)}</div> : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="odp-empty-inline">No items in this order</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}