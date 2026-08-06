const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_API_BASE ||
  'https://vandhana-shopping-mall-backend.vercel.app'

function buildUrl(path) {
  const normalizedPath = String(path || '')

  const apiPath = normalizedPath.startsWith('/api')
    ? normalizedPath
    : `/api${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`

  return `${API_BASE.replace(/\/+$/, '')}${apiPath}`
}

function getStoredToken() {
  if (typeof window === 'undefined') return ''

  return (
    window.localStorage.getItem('auth_token') ||
    window.localStorage.getItem('admin_token') ||
    window.localStorage.getItem('token') ||
    window.localStorage.getItem('adminToken') ||
    window.localStorage.getItem('accessToken') ||
    ''
  )
}

function buildHeaders(customHeaders = {}, includeJsonContentType = false) {
  const token = getStoredToken()
  const hasAuthorization = Boolean(
    customHeaders.Authorization ||
    customHeaders.authorization
  )

  return {
    ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token && !hasAuthorization ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders
  }
}

async function parseResponse(res) {
  const isJson = res.headers
    .get('content-type')
    ?.includes('application/json')

  const data = isJson
    ? await res.json().catch(() => ({}))
    : await res.text()

  if (!res.ok) {
    const message =
      isJson && data?.message
        ? data.message
        : `HTTP ${res.status}`

    const error = new Error(message)

    error.status = res.status
    error.payload = data

    throw error
  }

  return data
}

async function request(method, path, body, opts = {}) {
  const url = buildUrl(path)
  const headers = buildHeaders(opts.headers || {}, true)

  const hasBody =
    body !== undefined &&
    body !== null

  const res = await fetch(url, {
    method,
    headers,
    body: hasBody
      ? JSON.stringify(body)
      : undefined,
    credentials: 'omit',
    mode: 'cors',
    signal: opts.signal
  })

  return parseResponse(res)
}

export function apiPost(path, data, opts) {
  return request('POST', path, data, opts)
}

export function apiPut(path, data, opts) {
  return request('PUT', path, data, opts)
}

export function apiPatch(path, data, opts) {
  return request('PATCH', path, data, opts)
}

export function apiDelete(path, data, opts) {
  return request('DELETE', path, data, opts)
}

export function apiGet(path, params = {}, opts = {}) {
  const usp = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      usp.set(key, String(value))
    }
  })

  const fullPath = usp.toString()
    ? `${path}?${usp.toString()}`
    : path

  return request('GET', fullPath, null, opts)
}

export async function apiUpload(path, formData, opts = {}) {
  const url = buildUrl(path)

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(opts.headers || {}),
    body: formData,
    credentials: 'omit',
    mode: 'cors',
    signal: opts.signal
  })

  return parseResponse(res)
}
