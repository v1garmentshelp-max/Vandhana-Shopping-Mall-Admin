import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReturnCourierControls from './ReturnCourierControls';
import ReturnResolutionControls from './ReturnResolutionControls';
import { staffRequest } from './orderStaffApi';
jest.mock('./orderStaffApi',()=>({staffRequest:jest.fn()}));
const changed=jest.fn(async()=>{});
const request=(overrides={})=>({id:7,status:'APPROVED',reverse_shipment:{shiprocket_order_id:'91',booking_reference:'RET-7',status:'CREATED',actions:{can_assign:true,can_cancel:true},...overrides}});
beforeEach(()=>{jest.clearAllMocks();staffRequest.mockResolvedValue({ok:true});});
test('admin selects an available courier before assigning the first return AWB',async()=>{
  staffRequest.mockResolvedValueOnce({couriers:[{courier_company_id:61,courier_name:'Courier One',rate:80}]}).mockResolvedValueOnce({ok:true});
  render(<ReturnCourierControls request={request()} onChanged={changed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Load return couriers'}));
  const select=await screen.findByLabelText('Return courier');
  expect(screen.getByRole('button',{name:'Assign return courier'})).toBeDisabled();
  fireEvent.change(select,{target:{value:'61'}});fireEvent.click(screen.getByRole('button',{name:'Assign return courier'}));
  await waitFor(()=>expect(staffRequest).toHaveBeenLastCalledWith('/returns/7/shipping/awb',{courier_id:61}));
});
test('courier replacement requires another courier and a reason',async()=>{
  staffRequest.mockResolvedValueOnce({couriers:[{courier_company_id:61,courier_name:'Old courier'},{courier_company_id:62,courier_name:'New courier'}]}).mockResolvedValueOnce({ok:true});
  render(<ReturnCourierControls request={request({awb:'OLD-AWB',courier_id:'61',courier_name:'Old courier',actions:{can_reassign:true,can_cancel:true}})} onChanged={changed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Find another courier'}));
  const select=await screen.findByLabelText('Return courier');expect(select.querySelector('option[value="61"]')).toBeNull();
  fireEvent.change(select,{target:{value:'62'}});expect(screen.getByRole('button',{name:'Confirm courier change'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for changing or cancelling pickup'),{target:{value:'Courier did not arrive'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm courier change'}));
  await waitFor(()=>expect(staffRequest).toHaveBeenLastCalledWith('/returns/7/shipping/reassign',{courier_id:62,reason:'Courier did not arrive'}));
});
test('an unconfirmed cancellation offers refresh without creating another return',()=>{
  render(<ReturnCourierControls request={request({operation:{type:'CANCEL'},actions:{needs_reconciliation:true}})} onChanged={changed}/>);
  expect(screen.getByText(/awaiting confirmation/)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Book replacement pickup'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Assign return courier'})).toBeNull();
  expect(screen.getByRole('button',{name:'Refresh return carrier status'})).toBeEnabled();
});
test('confirmed cancellation offers a replacement booking and preserves the customer return',async()=>{
  render(<ReturnCourierControls request={request({status:'RETURN CANCELED',cancelled_at:'2026-10-30T10:00:00Z',actions:{can_rebook:true}})} onChanged={changed}/>);
  expect(screen.getByText(/customer return remains approved/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Book replacement pickup'}));
  await waitFor(()=>expect(staffRequest).toHaveBeenCalledWith('/returns/7/shipping/rebook',{}));
});
test('out for pickup cannot display cancel, reassign or another pickup actions',()=>{
  render(<ReturnCourierControls request={request({awb:'LIVE-AWB',status:'RETURN OUT FOR PICKUP',actions:{}})} onChanged={changed}/>);
  for(const name of ['Find another courier','Cancel pickup booking','Request return pickup'])expect(screen.queryByRole('button',{name})).toBeNull();
});
test('double click sends one carrier mutation and shows its failure',async()=>{
  let rejectRequest;staffRequest.mockReturnValue(new Promise((_,reject)=>{rejectRequest=reject;}));
  render(<ReturnCourierControls request={request({awb:'LIVE-AWB',actions:{can_pickup:true}})} onChanged={changed}/>);
  const button=screen.getByRole('button',{name:'Request return pickup'});fireEvent.click(button);fireEvent.click(button);
  expect(staffRequest).toHaveBeenCalledTimes(1);rejectRequest(new Error('Pickup confirmation pending'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pickup confirmation pending');
});
test('inspection requires an explicit receipt and notes before restoring stock',async()=>{
  render(<ReturnResolutionControls request={{id:7,status:'APPROVED',sale:{payment_method:'COD'}}} onChanged={changed}/>);
  const button=screen.getByRole('button',{name:'Record received products'});expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Inspection notes'),{target:{value:'Tags and product checked'}});
  fireEvent.click(screen.getByLabelText(/selected products have arrived/));
  fireEvent.click(screen.getByLabelText(/Restore these inspected products/));fireEvent.click(button);
  await waitFor(()=>expect(staffRequest).toHaveBeenCalledWith('/order-management/returns/7/receive',{restock:true,inspection_notes:'Tags and product checked'}));
});
test('COD refund records an exact transfer reference and online refund uses the original gateway',async()=>{
  const base={id:7,status:'RECEIVED',type:'RETURN',items_received_at:'2026-10-30T10:00:00Z',refund:{amount:1000,amount_paise:100000,reward_points:0,excluded_delivery_and_cod:150}};
  const view=render(<ReturnResolutionControls request={{...base,sale:{payment_method:'COD'}}} onChanged={changed}/>);
  expect(screen.queryByRole('button',{name:'Refund original payment'})).toBeNull();
  const button=screen.getByRole('button',{name:'Record completed COD refund'});expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Bank / UPI refund reference'),{target:{value:'BANK-REFERENCE-01'}});
  fireEvent.click(screen.getByLabelText(/I sent the exact approved amount/));fireEvent.click(button);
  await waitFor(()=>expect(staffRequest).toHaveBeenCalledWith('/returns/7/refund-complete',{amount_paise:100000,reference:'BANK-REFERENCE-01',transfer_confirmed:true}));
  view.unmount();render(<ReturnResolutionControls request={{...base,sale:{payment_method:'ONLINE'}}} onChanged={changed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Refund original payment'}));
  await waitFor(()=>expect(staffRequest).toHaveBeenCalledWith('/order-management/refunds/RETURN/7/initiate',{amount_paise:100000}));
});
