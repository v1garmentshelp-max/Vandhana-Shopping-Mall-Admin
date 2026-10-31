const defaultBase='https://vandhana-shopping-mall-backend.vercel.app';
export const API_BASE=(process.env.REACT_APP_API_BASE || defaultBase).replace(/\/+$/,'');
export const getStaffToken=()=>localStorage.getItem('auth_token')||localStorage.getItem('admin_token')||localStorage.getItem('token')||localStorage.getItem('adminToken')||localStorage.getItem('accessToken')||'';
export async function staffRequest(path,body,signal) {
  const response=await fetch(`${API_BASE}/api${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',signal,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${getStaffToken()}`},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(response.status===401?'Please sign in again.':response.status>=500?'The server could not complete this request. Refresh and retry.':data.message||'Request could not be completed.');
  return data;
}
