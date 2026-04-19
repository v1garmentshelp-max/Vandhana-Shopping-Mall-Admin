import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

const AuthCtx = createContext({ token: null, user: null, ready: false, login: () => {}, logout: () => {} })

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('auth_token')
    const u = localStorage.getItem('auth_user')
    if (t && u) {
      setToken(t)
      try { setUser(JSON.parse(u)) } catch { setUser(null) }
    }
    setReady(true)
  }, [])

  const login = useCallback((t, u) => {
    localStorage.setItem('auth_token', t)
    localStorage.setItem('auth_user', JSON.stringify(u || null))
    setToken(t)
    setUser(u || null)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ token, user, ready, login, logout }), [token, user, ready, login, logout])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
