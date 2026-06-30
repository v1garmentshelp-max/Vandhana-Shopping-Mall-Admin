import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const AuthCtx = createContext({
  token: null,
  user: null,
  ready: false,
  login: () => false,
  logout: () => {},
})

const cleanToken = (value) => {
  if (!value) return null
  return String(value).replace(/^Bearer\s+/i, '').trim()
}

const decodeJwtPayload = (token) => {
  try {
    const clean = cleanToken(token)
    if (!clean) return null

    const parts = clean.split('.')
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = atob(padded)

    return JSON.parse(json)
  } catch {
    return null
  }
}

const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true
  return payload.exp * 1000 <= Date.now()
}

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const t = cleanToken(localStorage.getItem('auth_token'))
    const u = getStoredUser()

    if (t && !isTokenExpired(t)) {
      localStorage.setItem('auth_token', t)
      setToken(t)
      setUser(u)
    } else {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      setToken(null)
      setUser(null)
    }

    setReady(true)
  }, [])

  useEffect(() => {
    if (!token) return

    if (isTokenExpired(token)) {
      logout()
      return
    }

    const payload = decodeJwtPayload(token)
    const expiryTime = payload?.exp ? payload.exp * 1000 : 0
    const delay = Math.max(expiryTime - Date.now(), 0)

    const timer = window.setTimeout(() => {
      logout()
    }, delay)

    return () => window.clearTimeout(timer)
  }, [token, logout])

  useEffect(() => {
    const handleStorage = () => {
      const t = cleanToken(localStorage.getItem('auth_token'))
      const u = getStoredUser()

      if (t && !isTokenExpired(t)) {
        setToken(t)
        setUser(u)
      } else {
        setToken(null)
        setUser(null)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const login = useCallback((t, u) => {
    const nextToken = cleanToken(t)

    if (!nextToken || isTokenExpired(nextToken)) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      setToken(null)
      setUser(null)
      return false
    }

    localStorage.setItem('auth_token', nextToken)
    localStorage.setItem('auth_user', JSON.stringify(u || null))
    setToken(nextToken)
    setUser(u || null)

    return true
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      login,
      logout,
    }),
    [token, user, ready, login, logout],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}