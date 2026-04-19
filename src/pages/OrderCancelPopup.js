import React, { useEffect, useState } from 'react'
import './OrderCancelPopup.css'

function fmtAmount(n) {
  return `₹${Number(n || 0).toFixed(2)}`
}

function getPayable(sale) {
  if (sale && sale.totals && sale.totals.payable != null) return Number(sale.totals.payable)
  if (sale && sale.total != null) return Number(sale.total)
  if (Array.isArray(sale?.items) && sale.items.length) {
    return sale.items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0)
  }
  return 0
}

function getPaymentLabel(sale) {
  if (!sale) return '-'
  const raw = String(sale.payment_status || 'COD').toUpperCase()
  if (raw.includes('COD')) return 'Cash on Delivery'
  if (raw.includes('PREPAID') || raw.includes('ONLINE') || raw.includes('PAID')) return 'Prepaid / Online'
  return raw || '-'
}

export default function OrderCancelPopup({
  open,
  sale,
  onClose,
  onConfirm,
  isSubmitting
}) {
  const [reasonType, setReasonType] = useState('stock')
  const [notes, setNotes] = useState('')
  const [confirmNotify, setConfirmNotify] = useState(false)
  const [confirmIrreversible, setConfirmIrreversible] = useState(false)

  useEffect(() => {
    if (open) {
      setReasonType('stock')
      setNotes('')
      setConfirmNotify(false)
      setConfirmIrreversible(false)
    }
  }, [open, sale?.id])

  if (!open || !sale) return null

  const payable = getPayable(sale)
  const paymentLabel = getPaymentLabel(sale)
  const cancelDisabled = !confirmNotify || !confirmIrreversible || isSubmitting
  const itemCount = Array.isArray(sale.items) ? sale.items.length : 0

  const handleBackdropClick = () => {
    if (isSubmitting) return
    onClose && onClose()
  }

  const handleDialogClick = e => {
    e.stopPropagation()
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (cancelDisabled) return
    const baseLabel =
      reasonType === 'stock'
        ? 'Cancelled by admin: stock or product issue'
        : reasonType === 'address'
        ? 'Cancelled by admin: address or contact issue'
        : reasonType === 'payment'
        ? 'Cancelled by admin: payment or refund risk'
        : reasonType === 'customer'
        ? 'Cancelled by admin: customer requested cancellation'
        : 'Cancelled by admin'
    const trimmedNotes = notes.trim()
    const finalReason = trimmedNotes ? `${baseLabel}. Notes: ${trimmedNotes}` : baseLabel
    onConfirm && onConfirm(finalReason)
  }

  return (
    <div className="ocp-backdrop" onClick={handleBackdropClick}>
      <div className="ocp-dialog" onClick={handleDialogClick}>
        <div className="ocp-header">
          <div className="ocp-header-main">
            <div className="ocp-header-top">
              <div className="ocp-header-icon">
                <span>!</span>
              </div>
              <div className="ocp-header-text">
                <div className="ocp-title">Cancel order</div>
                <div className="ocp-chip-subtle">
                  Order #{sale.id}
                </div>
              </div>
            </div>
            <div className="ocp-subtitle">
              You are cancelling this order. This will stop fulfilment and the customer should be informed clearly.
            </div>
          </div>
          <button className="ocp-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <div className="ocp-section ocp-section-summary">
          <div className="ocp-summary-row">
            <div className="ocp-summary-block">
              <div className="ocp-label">Customer</div>
              <div className="ocp-value">
                {sale.customer_name || '-'}
              </div>
              <div className="ocp-subvalue">
                {sale.customer_mobile || 'No phone added'}
              </div>
            </div>
            <div className="ocp-summary-block ocp-summary-right">
              <div className="ocp-label">Amount payable</div>
              <div className="ocp-value-strong">{fmtAmount(payable)}</div>
              <div className="ocp-summary-pill-row">
                <div className="ocp-chip ocp-chip-payment">
                  {paymentLabel}
                </div>
                {itemCount > 0 && (
                  <div className="ocp-chip ocp-chip-neutral">
                    {itemCount} item{itemCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="ocp-summary-row ocp-summary-row-secondary">
            <div className="ocp-summary-block">
              <div className="ocp-summary-meta">
                <span className="ocp-meta-label">Order ID</span>
                <span className="ocp-meta-value">#{sale.id}</span>
              </div>
              {sale.created_at && (
                <div className="ocp-summary-meta">
                  <span className="ocp-meta-label">Placed on</span>
                  <span className="ocp-meta-value">
                    {new Date(sale.created_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="ocp-banner">
            Use a clear reason and short note. This helps your team and makes it easier to explain the cancellation to the customer.
          </div>
        </div>

        <div className="ocp-body-scroll">
          <div className="ocp-section">
            <div className="ocp-field-label">Main reason</div>
            <div className="ocp-radio-group">
              <label className="ocp-radio">
                <input
                  type="radio"
                  name="ocp_reason"
                  value="stock"
                  checked={reasonType === 'stock'}
                  onChange={e => setReasonType(e.target.value)}
                  disabled={isSubmitting}
                />
                <span>Stock or product issue (out of stock, damaged piece, wrong SKU)</span>
              </label>
              <label className="ocp-radio">
                <input
                  type="radio"
                  name="ocp_reason"
                  value="address"
                  checked={reasonType === 'address'}
                  onChange={e => setReasonType(e.target.value)}
                  disabled={isSubmitting}
                />
                <span>Address or contact issue (invalid address, phone not reachable)</span>
              </label>
              <label className="ocp-radio">
                <input
                  type="radio"
                  name="ocp_reason"
                  value="payment"
                  checked={reasonType === 'payment'}
                  onChange={e => setReasonType(e.target.value)}
                  disabled={isSubmitting}
                />
                <span>Payment or refund concern (duplicate order, suspicious payment)</span>
              </label>
              <label className="ocp-radio">
                <input
                  type="radio"
                  name="ocp_reason"
                  value="customer"
                  checked={reasonType === 'customer'}
                  onChange={e => setReasonType(e.target.value)}
                  disabled={isSubmitting}
                />
                <span>Customer requested cancellation through call or message</span>
              </label>
              <label className="ocp-radio">
                <input
                  type="radio"
                  name="ocp_reason"
                  value="other"
                  checked={reasonType === 'other'}
                  onChange={e => setReasonType(e.target.value)}
                  disabled={isSubmitting}
                />
                <span>Other internal reason</span>
              </label>
            </div>
            <textarea
              className="ocp-textarea"
              placeholder="Short note for internal use and for customer explanation. Example: Customer asked to cancel as delivery date was too late."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="ocp-section ocp-section-confirm">
            <div className="ocp-field-label">Before you cancel</div>
            <div className="ocp-confirm-cards">
              <label className="ocp-checkbox-card">
                <div className="ocp-checkbox-inner">
                  <input
                    type="checkbox"
                    checked={confirmNotify}
                    onChange={e => setConfirmNotify(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <div className="ocp-checkbox-text">
                    <div className="ocp-checkbox-title">
                      Inform the customer
                    </div>
                    <div className="ocp-checkbox-desc">
                      I will make sure the customer is told that this order is cancelled and why it was cancelled.
                    </div>
                  </div>
                </div>
              </label>
              <label className="ocp-checkbox-card">
                <div className="ocp-checkbox-inner">
                  <input
                    type="checkbox"
                    checked={confirmIrreversible}
                    onChange={e => setConfirmIrreversible(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <div className="ocp-checkbox-text">
                    <div className="ocp-checkbox-title">
                      Final action
                    </div>
                    <div className="ocp-checkbox-desc">
                      I understand this action cannot be reversed here. The order status will be set to cancelled.
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="ocp-footer">
          <button
            type="button"
            className="ocp-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep order
          </button>
          <button
            type="button"
            className={cancelDisabled ? 'ocp-btn-primary ocp-btn-primary-disabled' : 'ocp-btn-primary'}
            disabled={cancelDisabled}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}
