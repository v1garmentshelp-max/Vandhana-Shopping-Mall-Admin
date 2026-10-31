import React, { useRef, useState } from 'react';
import { staffRequest } from './orderStaffApi';
import './OrderOperations.css';
const cash=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(value||0));
export default function ReturnCourierControls({request,onChanged}) {
  const [couriers,setCouriers]=useState([]),[courier,setCourier]=useState(''),[remote,setRemote]=useState('');
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const working=useRef(false);
  async function run(action,body) {
    if(working.current)return;
    working.current=true;setBusy(true);setError('');setMessage('');
    try {
      const result=await staffRequest(`/returns/${request.id}/shipping/${action}`,body);
      if(action==='couriers'){setCouriers(result.couriers||[]);setCourier('');if(!result.couriers?.length)setMessage('No return courier is available for this route. Check again later or contact Shiprocket.');}
      else {setCouriers([]);setCourier('');setMessage(result.message||'Carrier update saved.');}
      await onChanged();
    }catch(e){setError(e.message);try{await onChanged();}catch{}}
    finally{working.current=false;setBusy(false);}
  }
  const reverse=request.reverse_shipment;
  if(request.items_received_at||['REJECTED','CANCELLED'].includes(request.status))return null;
  const actions=reverse?.actions||{};
  const approved=request.status==='APPROVED';
  const canSelect=approved&&(actions.can_assign||actions.can_reassign);
  const needsLink=!reverse?.shiprocket_order_id;
  const change=!!reverse?.awb;
  return <section className="v1ops-reverse" aria-label="Return courier management">
    <h4>Return courier & pickup</h4>
    {error&&<p className="v1ops-error" role="alert">{error}</p>}
    {message&&<p className="v1ops-note" role="status">{message}</p>}
    {reverse?.last_error&&<p className="v1ops-error">{reverse.last_error}</p>}
    {reverse&&<><p><strong>{reverse.courier_name||'Courier not assigned'}</strong> · {String(reverse.status).replace(/_/g,' ')}</p><p>AWB: {reverse.awb||'Pending'} · Booking: {reverse.booking_reference||`RET-${request.id}`}</p></>}
    {reverse?.operation&&<p className="v1ops-note">{reverse.operation.type==='CANCEL'?'Cancellation':'Courier change'} is awaiting confirmation. Refresh carrier status before another booking.</p>}
    {needsLink&&<><p>Find reference {reverse?.booking_reference||`RET-${request.id}`} in Shiprocket after an uncertain booking response. Link that existing return.</p><div className="v1ops-actions"><label>Shiprocket return order ID<input value={remote} onChange={e=>setRemote(e.target.value.replace(/\D/g,''))} placeholder="Numeric carrier return order ID"/></label><button disabled={busy||!remote} onClick={()=>void run('reconcile',{order_id:remote})}>Link return booking</button></div></>}
    {reverse?.shiprocket_order_id&&<button disabled={busy} onClick={()=>void run('reconcile',{})}>Refresh return carrier status</button>}
    {canSelect&&<><button disabled={busy} onClick={()=>void run('couriers')}>{change?'Find another courier':'Load return couriers'}</button>{!!couriers.length&&<div className="v1ops-actions"><label>Return courier<select value={courier} onChange={e=>setCourier(e.target.value)}><option value="">Choose courier</option>{couriers.filter(c=>!change||String(c.courier_company_id)!==String(reverse.courier_id)).map(c=><option key={c.courier_company_id} value={c.courier_company_id}>{c.courier_name} · {c.rate==null?'Rate not provided':cash(c.rate)}{c.etd?` · Estimate ${c.etd}`:''}</option>)}</select></label><button disabled={busy||!courier||(change&&reason.trim().length<5)} onClick={()=>void run(change?'reassign':'awb',{courier_id:Number(courier),...(change?{reason}: {})})}>{change?'Confirm courier change':'Assign return courier'}</button></div>}</>}
    {approved&&(actions.can_cancel||actions.can_reassign)&&<label className="v1ops-field">Reason for changing or cancelling pickup<textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} placeholder="Example: Courier did not collect the return"/></label>}
    <div className="v1ops-actions">
      {approved&&actions.can_pickup&&<button disabled={busy} onClick={()=>void run('pickup',{})}>Request return pickup</button>}
      {approved&&actions.can_cancel&&<button disabled={busy||reason.trim().length<5} onClick={()=>void run('cancel',{reason})}>Cancel pickup booking</button>}
      {approved&&(actions.can_rebook||reverse?.status==='BOOKING_FAILED')&&<button disabled={busy} onClick={()=>void run('rebook',{})}>{reverse.status==='BOOKING_FAILED'?'Retry rejected booking':'Book replacement pickup'}</button>}
    </div>
    {reverse?.cancelled_at&&<p>The pickup booking is cancelled. The customer return remains approved. Book the replacement, select its courier, then request pickup.</p>}
    {reverse?.reassigned_at&&<p>Courier changed {new Date(reverse.reassigned_at).toLocaleString('en-IN')}. Shiprocket allows one reassignment per 24 hours.</p>}
    {change&&<p className="v1ops-muted">Use the current AWB for handover. The carrier checks availability and pickup status before changes are accepted.</p>}
    {(reverse?.awb_history?.length>0||request.reverse_history?.length>0)&&<details><summary>Previous courier bookings</summary><ul>{(reverse.awb_history||[]).map((item,i)=><li key={`awb-${i}`}>{item.courier_name||'Previous courier'} · {item.awb} · Replaced</li>)}{(request.reverse_history||[]).map(item=><li key={item.id}>{item.booking_reference||`RET-${request.id}`} · {item.courier_name||'Courier'} · {item.awb||'No AWB'} · {item.status}</li>)}</ul></details>}
  </section>;
}
