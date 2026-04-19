const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_API_BASE ||
  'https://taras-kart-backend.vercel.app';

function buildUrl(path) {
  const p = path.startsWith('/api') ? path : `/api${path}`;
  return `${API_BASE.replace(/\/+$/, '')}${p}`;
}

async function request(method, path, body, opts = {}) {
  const url = buildUrl(path);
  const isLogin = url.includes('/api/auth-branch/login');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (!isLogin) {
    const token = localStorage.getItem('auth_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } else {
    delete headers.Authorization;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
    mode: 'cors'
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const msg = isJson && data && data.message ? data.message : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export function apiPost(path, data, opts) {
  return request('POST', path, data, opts);
}

export function apiGet(path, params = {}, opts) {
  const usp = new URLSearchParams(params);
  const full = usp.toString() ? `${path}?${usp.toString()}` : path;
  return request('GET', full, null, opts);
}

export async function apiUpload(path, formData) {
  const url = buildUrl(path);
  const headers = {};
  const token = localStorage.getItem('auth_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'omit',
    mode: 'cors'
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const msg = isJson && data && data.message ? data.message : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}
