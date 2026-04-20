import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AdminAuth'
import { useLoading } from './LoadingContext'
import './LoginAdmin.css'

const BASE_URL = 'https://vandhana-shopping-mall-backend.vercel.app'

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

    if (!username.trim() || !password.trim()) {
      setErr('Please enter username and password')
      return
    }

    setBusy(true)
    show()

    try {
      const res = await fetch(`${BASE_URL}/api/auth-branch/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.message || 'Invalid credentials')
      }

      login(data.token, data.user)
      nav('/', { replace: true })
    } catch (error) {
      setErr(error.message || 'Invalid credentials')
    } finally {
      hide()
      setBusy(false)
    }
  }

  return (
    <div className="branch-login-page">
      <div className="branch-login-glow branch-login-glow-one" />
      <div className="branch-login-glow branch-login-glow-two" />

      <div className="branch-login-card">
        <div className="branch-login-brand">
          <div className="branch-login-badge">Admin Panel</div>
          <h1 className="branch-login-title">Branch Admin Login</h1>
          <p className="branch-login-subtitle">Sign in to access and manage your branch dashboard</p>
        </div>

        <form onSubmit={onSubmit} className="branch-login-form">
          <div className="branch-login-field">
            <label className="branch-login-label">Username</label>
            <div className="branch-login-input-wrap">
              <span className="branch-login-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v3h16v-3c0-2.761-3.582-5-8-5z" />
                </svg>
              </span>
              <input
                className="branch-login-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="branch-login-field">
            <label className="branch-login-label">Password</label>
            <div className="branch-login-input-wrap">
              <span className="branch-login-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 9h-1V7a4 4 0 10-8 0v2H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-9a2 2 0 00-2-2zm-7-2a2 2 0 114 0v2h-4V7zm7 11H7v-7h10v7z" />
                </svg>
              </span>
              <input
                className="branch-login-input branch-login-password-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="branch-login-toggle"
                onClick={() => setShowPwd((prev) => !prev)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {err ? <div className="branch-login-error">{err}</div> : null}

          <div className="branch-login-row">
            <label className="branch-login-remember">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="branch-login-link"
              onClick={() => nav('/forgot-password')}
            >
              Forgot password?
            </button>
          </div>

          <button
            className="branch-login-submit"
            type="submit"
            disabled={busy || !username.trim() || !password.trim()}
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="branch-login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="branch-login-back"
            onClick={() => nav('/', { replace: true })}
          >
            Back to Website
          </button>
        </form>
      </div>
    </div>
  )
}