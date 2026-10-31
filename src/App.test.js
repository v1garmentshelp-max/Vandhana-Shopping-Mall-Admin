import { staffRequest } from './components/orderStaffApi';
beforeEach(()=>{localStorage.clear();global.fetch=jest.fn();});
test('staff requests carry the signed in session and surface a policy rejection',async()=>{
  localStorage.setItem('auth_token','staff-test-session');
  fetch.mockResolvedValue({ok:false,status:409,json:async()=>({message:'Pickup already started'})});
  await expect(staffRequest('/returns/7/shipping/cancel',{reason:'Missed pickup'})).rejects.toThrow('Pickup already started');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer staff-test-session');
});
test('expired staff sessions ask the operator to sign in again',async()=>{
  fetch.mockResolvedValue({ok:false,status:401,json:async()=>({})});
  await expect(staffRequest('/order-management/orders')).rejects.toThrow('Please sign in again.');
});
