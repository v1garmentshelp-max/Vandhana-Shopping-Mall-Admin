import React, { useCallback, useEffect, useRef, useState } from 'react'
import './OrderShippingPanel.css'

export default function OrderShippingPanel({ saleId, apiBase, token, onShipment }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [couriers, setCouriers] = useState([])
  const [courierId, setCourierId] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [absent, setAbsent] = useState(false)
  const [pickups, setPickups] = useState([])
  const [pickupId, setPickupId] = useState('')
  const [tracking, setTracking] = useState(null)
  const [document, setDocument] = useState(null)
  const alive = useRef(true)
  const request = useCallback(async (path = '', body) => {
    const response = await fetch(`${apiBase}/api/order-shipping/${saleId}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) throw new Error(result?.message || `Unable to load shipping (${response.status}). Check that the backend update is deployed.`)
    return result
  }, [apiBase, saleId, token])
  const update = useCallback(next => {
    if (!alive.current) return
    setState(next)
    if (next.shipment) onShipment(next.shipment)
  }, [onShipment])
  useEffect(() => {
    alive.current = true
    let current = true
    request().then(next => { if (current) update(next) }).catch(e => { if (current) setError(e.message) })
    return () => { current = false; alive.current = false }
  }, [request, update])
  async function action(task) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await task() }
    catch (e) { if (alive.current) setError(e.message) }
    finally {
      try { update(await request()) } catch (e) { if (alive.current) setError(previous => previous || e.message) }
      if (alive.current) setBusy(false)
    }
  }
  const shipment = state?.shipment
  const linked = !!shipment?.shiprocket_shipment_id
  const hasAwb = typeof shipment?.awb === 'string' && /^[A-Za-z0-9-]+$/.test(shipment.awb)
  const blocked = !state || !!state.blocked
  const uncertain = !!state?.workflow?.create_attempted && !linked
  const legacy = !state?.workflow || state.workflow.phase === 'LEGACY_UNKNOWN'
  const credentialsMissing = state && !state.credentials_configured
  const pickupMissing = state && (!state.warehouse?.name || !/^\d{6}$/.test(String(state.warehouse.pincode || '')))

  return <section className="osp" aria-label="Order shipping" aria-busy={busy}>
    <div className="osp-head"><div><h3>Ship this order</h3><p>Complete each step below. The order is already saved; do not place it again.</p></div>
      <button type="button" disabled={busy} onClick={() => action(async () => update(await request()))}>Refresh</button></div>
    {error && <p className="osp-error" role="alert">{error}</p>}
    {state?.workflow?.last_error && state.workflow.last_error !== error && <p className="osp-error">Last shipping error: {state.workflow.last_error}</p>}
    {state?.blocked && <p className="osp-error">{state.blocked}</p>}
    {credentialsMissing && <p className="osp-error">Shiprocket API credentials are missing from this backend deployment. Configure SHIPROCKET_API_USER_EMAIL and SHIPROCKET_API_USER_PASSWORD, then redeploy.</p>}
    {pickupMissing && !linked && <div className="osp-stage">
      <h4>Set pickup location for branch {state.sale.branch_id}</h4>
      <p>Select the warehouse that actually dispatches this branch’s orders. This mapping applies to future orders too.</p>
      <button type="button" disabled={busy || credentialsMissing || blocked} onClick={() => action(async () => setPickups((await request('/pickups')).pickups))}>Load Shiprocket pickup locations</button>
      {pickups.length > 0 && <div className="osp-row"><select aria-label="Pickup location" value={pickupId} onChange={e => setPickupId(e.target.value)}><option value="">Select pickup location</option>{pickups.map(p => <option key={p.id || p.pickup_id} value={p.id || p.pickup_id}>{p.pickup_location} — {p.city}, {p.pin_code}</option>)}</select>
        <button type="button" disabled={busy || !pickupId} onClick={() => action(async () => update(await request('/warehouse', { pickup_id: pickupId })))}>Save pickup location</button></div>}
    </div>}
    <div className="osp-stage"><h4>1. Connect order to Shiprocket {linked ? '✓' : ''}</h4>
      {linked ? <p>Shiprocket order: <strong>{shipment.shiprocket_order_id}</strong> · Shipment: <strong>{shipment.shiprocket_shipment_id}</strong></p> : <>
        <p>Website order ID: <strong>{saleId}</strong></p><p>Initial package: 0.5 kg, 10 × 10 × 5 cm. Check the packed weight and dimensions in Shiprocket before choosing a courier.</p>
        {(legacy || uncertain) && <p>Search this website order ID in Shiprocket. If it exists, copy its numeric Shiprocket order ID below to link it without creating another order.</p>}
        <div className="osp-row"><input aria-label="Numeric Shiprocket order ID" inputMode="numeric" placeholder="Existing Shiprocket order ID" value={remoteId} onChange={e => setRemoteId(e.target.value)} />
          <button type="button" disabled={busy || blocked || !/^\d+$/.test(remoteId) || credentialsMissing} onClick={() => action(async () => update(await request('/connect', { remote_order_id: remoteId })))}>Link existing order</button></div>
        {uncertain ? <p className="osp-error">A creation request was already attempted. Automatic recreation is blocked until that request is reconciled.</p> : <>
          {legacy && <label className="osp-check"><input type="checkbox" checked={absent} onChange={e => setAbsent(e.target.checked)} />I searched this order ID in Shiprocket and confirmed that it does not exist.</label>}
          <button type="button" className="osp-primary" disabled={busy || blocked || pickupMissing || credentialsMissing || (legacy && !absent)} onClick={() => action(async () => update(await request('/connect', { confirmed_absent: absent })))}>Connect order to Shiprocket</button>
        </>}
      </>}
    </div>
    <div className="osp-stage"><h4>2. Select courier and generate AWB {hasAwb ? '✓' : ''}</h4>
      {hasAwb ? <p>AWB: <strong>{shipment.awb}</strong></p> : <>
        <p>{linked ? 'Choose an available courier. AWB generation can charge your Shiprocket wallet.' : 'Connect the order first to load courier options.'}</p>
        <button type="button" disabled={busy || blocked || !linked} onClick={() => action(async () => { const data = await request('/couriers'); setCouriers(data?.data?.available_courier_companies || []); setCourierId(''); if (!data?.data?.available_courier_companies?.length) setError('No couriers are currently available for this order.') })}>Get courier options</button>
        {couriers.length > 0 && <div className="osp-row"><select aria-label="Courier" value={courierId} onChange={e => setCourierId(e.target.value)}><option value="">Select courier</option>{couriers.map(c => <option key={c.courier_company_id} value={c.courier_company_id} disabled={!!c.blocked}>{c.courier_name} — ₹{c.rate ?? c.freight_charge ?? '—'}{c.blocked ? ' (unavailable)' : ''}</option>)}</select>
          <button type="button" className="osp-primary" disabled={busy || blocked || !linked || !courierId} onClick={() => action(async () => update(await request('/awb', { courier_id: courierId })))}>Generate AWB</button></div>}
        {state?.workflow?.awb_attempted && linked && <button type="button" disabled={busy || blocked} onClick={() => action(async () => update(await request('/awb', {})))}>Check previous AWB request</button>}
      </>}
      <p><a href="https://app.shiprocket.in/" target="_blank" rel="noopener noreferrer">Open Shiprocket ↗</a> · Sign in to the same account and use its wallet to recharge.</p>
    </div>
    <div className="osp-stage"><h4>3. Request pickup and print documents</h4>
      <p>{state?.workflow?.pickup_requested_at ? 'Pickup request accepted. This does not mean the courier has collected the parcel.' : 'Pack the parcel and attach its label before handing it to the courier.'}</p>
      <div className="osp-row"><button type="button" className="osp-primary" disabled={busy || blocked || !hasAwb || !!state?.workflow?.pickup_requested_at || !!state?.workflow?.pickup_attempted} onClick={() => action(async () => update(await request('/pickup', {})))}>Request pickup</button>
        {['label', 'invoice', 'manifest'].map(type => <button type="button" key={type} disabled={busy || !hasAwb} onClick={() => action(async () => setDocument({ type, ...(await request(`/documents/${type}`, {})) }))}>Get {type}</button>)}
      </div>
      {state?.workflow?.pickup_attempted && !state.workflow.pickup_requested_at && <p className="osp-error">Pickup response was not confirmed. Check the request in Shiprocket before retrying there.</p>}
      {document && <p><a href={document.url} target="_blank" rel="noopener noreferrer">Open {document.type} ↗</a></p>}
      <button type="button" disabled={busy || !hasAwb} onClick={() => action(async () => setTracking(await request('/tracking')))}>Refresh tracking</button>
      {tracking && <div><p>Current courier status: <strong>{tracking.status}</strong></p>{tracking.url && <a href={tracking.url} target="_blank" rel="noopener noreferrer">Open tracking ↗</a>}
        <ol>{tracking.events.slice(0, 8).map((event, index) => <li key={index}>{event.date} · {event.activity || event.status} · {event.location}</li>)}</ol></div>}
      <p>Use Shiprocket for pickup changes. Requesting pickup does not mark the order as shipped.</p>
    </div>
    {busy && <p role="status">Updating shipping… Please wait.</p>}
  </section>
}
