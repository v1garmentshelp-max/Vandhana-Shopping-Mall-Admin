import React, { useRef, useState } from 'react';
import { staffRequest } from './orderStaffApi';
export default function ReturnResolutionControls({request,onChanged}) {
  const [notes,setNotes]=useState(''),[restock,setRestock]=useState(false),[received,setReceived]=useState(false);
  const [reference,setReference]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const working=useRef(false);
  async function run(path,body) {
    if(working.current)return;
    working.current=true;setBusy(true);setError('');
    try{await staffRequest(path,body);await onChanged();}
    catch(e){setError(e.message);try{await onChanged();}catch{}}
    finally{working.current=false;setBusy(false);}
  }
  const refund=request.refund,operation=request.refund_operation;
  const cod=String(request.sale?.payment_method).toUpperCase()==='COD';
  const approved=['APPROVED','RECEIVED','COMPLETED'].includes(request.status);
  const done=request.refund_status==='REFUNDED';
  return <section className="rr-action-section" aria-label="Return inspection and refund">
    <h2>Receive, inspect & refund</h2>
    {error&&<p className="v1ops-error" role="alert">{error}</p>}
    {refund&&<><p><strong>Product refund: ₹{Number(refund.amount).toFixed(2)}</strong></p><p>Delivery / COD charges excluded: ₹{Number(refund.excluded_delivery_and_cod).toFixed(2)} · Points to restore: {refund.reward_points}</p></>}
    {!approved&&<p>Approve the return before receiving products or processing a refund.</p>}
    {approved&&!request.items_received_at&&<><label className="v1ops-field">Inspection notes<textarea value={notes} maxLength={1000} onChange={e=>setNotes(e.target.value)}/></label><label className="v1ops-field"><input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)}/> The selected products have arrived and I inspected them.</label><label className="v1ops-field"><input type="checkbox" checked={restock} onChange={e=>setRestock(e.target.checked)}/> Restore these inspected products to sellable stock.</label><button disabled={busy||!received||notes.trim().length<5} onClick={()=>void run(`/order-management/returns/${request.id}/receive`,{restock,inspection_notes:notes})}>Record received products</button></>}
    {request.items_received_at&&<p>Received {new Date(request.items_received_at).toLocaleString('en-IN')} · {request.inventory_restocked_at?'Sellable stock restored':'Kept out of sellable stock'}</p>}
    {done&&<p role="status">Refund completed{refund?.reference?` · ${refund.reference}`:''}.</p>}
    {request.items_received_at&&!done&&refund&&request.type!=='REPLACE'&&<>
      {operation&&<p>Payment provider status: {operation.status}{operation.provider_refund_id?` · ${operation.provider_refund_id}`:''}</p>}
      {cod&&Number(refund.amount_paise)>0?<><p>Transfer the exact approved product refund to the customer's bank / UPI, then record the reference.</p><label className="v1ops-field">Bank / UPI refund reference<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={100}/></label><label className="v1ops-field"><input type="checkbox" checked={sent} onChange={e=>setSent(e.target.checked)}/> I sent the exact approved amount to this customer.</label><button disabled={busy||!sent||reference.trim().length<6} onClick={()=>void run(`/returns/${request.id}/refund-complete`,{amount_paise:Number(refund.amount_paise),reference,transfer_confirmed:true})}>Record completed COD refund</button></>:<>
        <p>The online refund uses the original payment. Its status is confirmed with Razorpay.</p>
        {!operation&&<button disabled={busy} onClick={()=>void run(`/order-management/refunds/RETURN/${request.id}/initiate`,{amount_paise:Number(refund.amount_paise)})}>{Number(refund.amount_paise)>0?'Refund original payment':'Complete reward restoration'}</button>}
        {operation&&operation.status!=='PROCESSED'&&<button disabled={busy} onClick={()=>void run(`/order-management/refunds/RETURN/${request.id}/reconcile`,{})}>Check refund status</button>}
      </>}
    </>}
  </section>;
}
