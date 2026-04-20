import React, { useEffect, useState, useCallback } from 'react'
import './ReturnReview.css'
import Navbar from './NavbarAdmin'
import { useParams, useNavigate } from 'react-router-dom'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-IN')
}

function formatPriceFromTotals(totals) {
  if (!totals) return ''
  try {
    const obj = typeof totals === 'string' ? JSON.parse(totals) : totals
    const payable = Number(obj.payable || 0)
    if (!payable) return ''
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(payable)
  } catch {
    return ''
  }
}

export default function ReturnReview() {
  const { id: requestIdParam } = useParams()
  const navigate = useNavigate()

  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [refundLoading, setRefundLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('ok')

  const loadRequest = useCallback(async () => {
    if (!requestIdParam) {
      setLoading(false)
      setError('Missing request id')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/${requestIdParam}`, {
        cache: 'no-store'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || 'Unable to load request')
      }
      if (!data || !data.ok || !data.request) {
        throw new Error('Invalid response from server')
      }
      setRequest(data.request)
    } catch (e) {
      setError(e.message || 'Unable to load request')
    } finally {
      setLoading(false)
    }
  }, [requestIdParam])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  async function handleApprove() {
    if (!request) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || 'Unable to approve request')
      }
      setMessageType('ok')
      setMessage('Request approved successfully. Refund is now approved and pending completion.')
      await loadRequest()
    } catch (e) {
      setMessageType('error')
      setMessage(e.message || 'Error approving request.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!request) return
    if (!rejectReason.trim()) {
      setMessageType('error')
      setMessage('Please enter a reason before rejecting.')
      return
    }
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || 'Unable to reject request')
      }
      setMessageType('ok')
      setMessage('Request rejected successfully.')
      await loadRequest()
    } catch (e) {
      setMessageType('error')
      setMessage(e.message || 'Error rejecting request.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefundComplete() {
    if (!request) return
    setRefundLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/returns/${request.id}/refund-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || 'Unable to mark refund as completed')
      }
      setMessageType('ok')
      setMessage('Refund marked as completed.')
      await loadRequest()
    } catch (e) {
      setMessageType('error')
      setMessage(e.message || 'Error updating refund status.')
    } finally {
      setRefundLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rr-screen">
        <Navbar />
        <div className="rr-layout">
          <div className="rr-loader">
            <div className="rr-spinner" />
            <div className="rr-loader-text">Loading return request…</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="rr-screen">
        <Navbar />
        <div className="rr-layout">
          <div className="rr-empty">
            <h2 className="rr-empty-title">Unable to open request</h2>
            <p className="rr-empty-text">{error || 'Request not found.'}</p>
            <button
              type="button"
              className="rr-primary-btn"
              onClick={() => navigate('/returns')}
            >
              Back to returns
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sale = request.sale || {}
  const images = Array.isArray(request.image_urls) ? request.image_urls : []
  const bank = request.bank_details || {}

  const status = String(request.status || 'REQUESTED').toUpperCase()
  const refundStatus = String(request.refund_status || '').toUpperCase()
  const statusClass = status.toLowerCase()
  const refundClass = refundStatus ? refundStatus.toLowerCase() : 'not-started'

  const isRequested = status === 'REQUESTED'
  const isApproved = status === 'APPROVED'
  const isRejected = status === 'REJECTED'
  const canDecide = isRequested
  const canMarkRefundComplete = refundStatus === 'PENDING_REFUND'

  let progressLabel = 'Requested'
  if (refundStatus === 'REFUNDED') {
    progressLabel = 'Refund completed'
  } else if (refundStatus === 'PENDING_REFUND') {
    progressLabel = 'Refund approved'
  } else if (isRejected) {
    progressLabel = 'Rejected by admin'
  } else if (isApproved) {
    progressLabel = 'Accepted by admin'
  }

  return (
    <div className="rr-screen">
      <Navbar />
      <div className="rr-layout">
        <header className="rr-header">
          <div className="rr-header-main">
            <button
              type="button"
              className="rr-back-btn"
              onClick={() => navigate('/returns')}
            >
              <span className="rr-back-icon" />
              <span>Back to returns</span>
            </button>
            <div className="rr-header-title-block">
              <span className="rr-badge">Return Management</span>
              <h1 className="rr-title">Return / Refund Review</h1>
              <p className="rr-subtitle">
                Review product images, verify bank details, and complete the decision flow with a cleaner dashboard.
              </p>
            </div>
          </div>
          <div className="rr-header-tags">
            <span className={`rr-pill rr-pill-status rr-pill-status-${statusClass}`}>
              Status: {status}
            </span>
            <span className={`rr-pill rr-pill-refund rr-pill-refund-${refundClass}`}>
              Refund: {refundStatus || 'Not started'}
            </span>
          </div>
        </header>

        <div className="rr-top-grid">
          <div className="rr-card">
            <div className="rr-card-header">
              <h2>Order and Customer</h2>
              <div className="rr-card-caption">
                Request ID {request.id} for order {sale.id || request.sale_id}
              </div>
            </div>

            <div className="rr-summary-grid">
              <div className="rr-summary-item">
                <div className="rr-label">Request type</div>
                <div className="rr-value">
                  {request.type === 'REFUND'
                    ? 'Refund'
                    : request.type === 'REPLACE'
                    ? 'Replacement'
                    : 'Return'}
                </div>
              </div>
              <div className="rr-summary-item">
                <div className="rr-label">Order ID</div>
                <div className="rr-value">{sale.id || request.sale_id}</div>
              </div>
              <div className="rr-summary-item">
                <div className="rr-label">Order date</div>
                <div className="rr-value">{formatDate(sale.created_at)}</div>
              </div>
              <div className="rr-summary-item">
                <div className="rr-label">Customer email</div>
                <div className="rr-value">{request.customer_email || '-'}</div>
              </div>
              <div className="rr-summary-item">
                <div className="rr-label">Customer mobile</div>
                <div className="rr-value">{request.customer_mobile || '-'}</div>
              </div>
              <div className="rr-summary-item">
                <div className="rr-label">Paid amount</div>
                <div className="rr-value">
                  {sale.totals ? formatPriceFromTotals(sale.totals) : '-'}
                </div>
              </div>
            </div>

            <div className="rr-section-block">
              <div className="rr-label">Request notes</div>
              <div className="rr-box">
                <div className="rr-box-line">
                  <span className="rr-tag-mini">Notes</span>
                  <span className="rr-box-text">
                    {request.notes && request.notes.trim().length
                      ? request.notes
                      : 'No additional notes provided.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rr-section-block">
              <div className="rr-label">Progress</div>
              <div className="rr-box">
                <div className="rr-box-line">
                  <span className="rr-tag-mini">Stage</span>
                  <span className="rr-box-text">{progressLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rr-card rr-card-evidence">
            <div className="rr-card-header">
              <h2>Product Images</h2>
              <div className="rr-card-caption">
                Verify condition from the uploaded evidence before you approve.
              </div>
            </div>
            {images.length === 0 ? (
              <div className="rr-evidence-empty">
                No evidence images were uploaded with this request.
              </div>
            ) : (
              <div className="rr-evidence-grid">
                {images.map((url, index) => (
                  <button
                    type="button"
                    className="rr-evidence-item"
                    key={index}
                    onClick={() => window.open(url, '_blank', 'noopener')}
                  >
                    <div className="rr-evidence-thumb">
                      <img src={url} alt={`Evidence ${index + 1}`} />
                    </div>
                    <div className="rr-evidence-label">View image {index + 1}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rr-bottom-grid">
          <div className="rr-card rr-card-bank">
            <div className="rr-card-header">
              <h2>Bank / UPI Details</h2>
              <div className="rr-card-caption">
                Refund will be processed to these details after approval.
              </div>
            </div>
            <div className="rr-form-grid">
              <div className="rr-form-field">
                <label>Account holder name</label>
                <input type="text" value={bank.accountName || ''} disabled />
              </div>
              <div className="rr-form-field">
                <label>Bank name</label>
                <input type="text" value={bank.bankName || ''} disabled />
              </div>
              <div className="rr-form-field">
                <label>Account number</label>
                <input type="text" value={bank.accountNumber || ''} disabled />
              </div>
              <div className="rr-form-field">
                <label>IFSC code</label>
                <input type="text" value={bank.ifsc || ''} disabled />
              </div>
              <div className="rr-form-field rr-form-field-full">
                <label>UPI ID</label>
                <input type="text" value={bank.upiId || ''} disabled />
              </div>
            </div>
            <div className="rr-note">
              If these details look incorrect, contact the customer before initiating the refund.
            </div>
          </div>

          <div className="rr-card rr-card-actions">
            <div className="rr-action-section">
              <div className="rr-card-header">
                <h2>Decision</h2>
                <div className="rr-card-caption">
                  Approve if the product condition and details are valid, otherwise reject.
                </div>
              </div>
              <div className="rr-form-field rr-form-field-full">
                <label>Rejection reason (only required when rejecting)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Example: Used product, missing tags, wrong images, etc."
                  disabled={!canDecide || actionLoading}
                />
              </div>
              <div className="rr-action-row">
                <button
                  type="button"
                  className="rr-primary-btn"
                  onClick={handleApprove}
                  disabled={!canDecide || actionLoading}
                >
                  {actionLoading ? 'Processing…' : 'Approve request'}
                </button>
                <button
                  type="button"
                  className="rr-danger-btn"
                  onClick={handleReject}
                  disabled={!canDecide || actionLoading}
                >
                  {actionLoading ? 'Processing…' : 'Reject request'}
                </button>
              </div>
              {!canDecide && (
                <div className="rr-note">
                  This request is already {status.toLowerCase()}. You cannot change the decision.
                </div>
              )}
            </div>

            <div className="rr-divider" />

            <div className="rr-action-section">
              <div className="rr-card-header">
                <h2>Refund handling</h2>
                <div className="rr-card-caption">
                  After you send the refund from your payment gateway or bank, mark it completed.
                </div>
              </div>
              <div className="rr-refund-line">
                <span className="rr-refund-pill">
                  Current refund status: {refundStatus || 'Not started'}
                </span>
                <button
                  type="button"
                  className="rr-primary-btn ghost"
                  onClick={handleRefundComplete}
                  disabled={!canMarkRefundComplete || refundLoading}
                >
                  {refundLoading ? 'Updating…' : 'Mark refund completed'}
                </button>
              </div>
              {!canMarkRefundComplete && (
                <div className="rr-note">
                  Refund can be marked completed only after the request is approved and refund is
                  pending.
                </div>
              )}
            </div>

            {message && (
              <div
                className={`rr-message ${
                  messageType === 'error' ? 'rr-message-error' : 'rr-message-ok'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}