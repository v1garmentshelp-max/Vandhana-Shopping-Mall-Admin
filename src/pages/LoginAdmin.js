import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from './api'
import { useAuth } from './AdminAuth'
import { useLoading } from './LoadingContext'
import './LoginAdmin.css'

export default function LoginAdmin() {
  const { login } = useAuth()
  const { show, hide } = useLoading()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    show()
    try {
      const resp = await apiPost('/api/auth-branch/login', { username, password })
      login(resp.token, resp.user)
      nav('/', { replace: true })
    } catch (e2) {
      setErr('Invalid credentials')
    } finally {
      hide()
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap-admin-admin-login">
      <div className="login-card-admin-admin-login">
        <div className="login-header-admin-admin-login">
          <div className="login-title-admin-admin-login">Branch Admin Login</div>
          <div className="login-subtitle-admin-admin-login">Sign in to manage your branch dashboard</div>
        </div>

        <form onSubmit={onSubmit} className="login-form-admin-admin-login">
          <div className="login-field-admin-admin-login">
            <span className="login-input-icon-admin-admin-login" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z" />
              </svg>
            </span>
            <input
              className="login-input-admin-admin-login"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="login-field-admin-admin-login">
            <span className="login-input-icon-admin-admin-login" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8V7a5 5 0 10-10 0v1H5v14h14V8h-2zm-8-1a3 3 0 016 0v1H9V7zm8 5H7v8h10v-8z" />
              </svg>
            </span>
            <input
              className="login-input-admin-admin-login"
              type={showPwd ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-toggle-btn-admin-admin-login"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? 'Hide' : 'Show'}
            </button>
          </div>

          {err ? <div className="login-error-admin-admin-login">{err}</div> : null}

          <div className="login-actions-row-admin-admin-login">
            <label className="login-remember-admin-admin-login">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="login-alt-admin-admin-login login-link-btn-admin-admin-login"
              onClick={() => nav('/forgot-password')}
            >
              Forgot password?
            </button>
          </div>

          <button className="login-button-admin-admin-login" type="submit" disabled={busy || !username || !password}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="login-sep-admin-admin-login" />

          <button
            type="button"
            className="login-button-admin-admin-login login-button-ghost-admin-admin-login"
            onClick={() => nav('/', { replace: true })}
          >
            Back to website
          </button>
        </form>
      </div>
    </div>
  )
}