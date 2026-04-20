import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'
import './Sales.css'
import './B2BOrders.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')

export default function B2BOrders() {
  const { token } = useAuth()
  const [b2bSales, setB2bSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}
  }, [token])

  const fetchB2BSales = useCallback(async () => {
    setLoading(true)
    try {
      if (!token) {
        setB2bSales([])
        return
      }
      const res = await fetch(`${API_BASE}/api/sales/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => [])
      const filteredData = (Array.isArray(data) ? data : []).filter((order) => order.payment_method === 'B2B_BULK')
      setB2bSales(filteredData)
    } catch {
      setB2bSales([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchB2BSales()
  }, [fetchB2BSales])

  const handleUpdateStatus = async (saleId, newStatus, newPaymentStatus) => {
    if (!window.confirm(`Are you sure you want to update this order to ${newStatus || newPaymentStatus}?`)) return

    setActionLoading(saleId)
    try {
      const res = await fetch(`${API_BASE}/api/sales/web/b2b-update-status`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sale_id: saleId,
          new_status: newStatus,
          new_payment_status: newPaymentStatus
        })
      })

      if (res.ok) {
        fetchB2BSales()
        if (selectedOrder && selectedOrder.id === saleId) {
          const nextStatus = newStatus || selectedOrder.status
          const nextPaymentStatus = newPaymentStatus || selectedOrder.payment_status
          setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus, payment_status: nextPaymentStatus } : prev))
        }
      } else {
        alert('Failed to update status')
      }
    } catch {
      alert('Error updating order')
    } finally {
      setActionLoading(null)
    }
  }

  const openOrderDetails = async (sale) => {
    setSelectedOrder(sale)
    setItemsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sales/admin/${sale.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      setOrderItems(data.items || [])
    } catch {
      setOrderItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  const closeOrderDetails = () => {
    setSelectedOrder(null)
    setOrderItems([])
  }

  const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`

  const stats = useMemo(() => {
    const pending = b2bSales.filter((s) => s.status === 'B2B_PENDING').length
    const approved = b2bSales.filter((s) => s.status === 'APPROVED').length
    const dispatched = b2bSales.filter((s) => s.status === 'DISPATCHED').length
    const delivered = b2bSales.filter((s) => s.status === 'DELIVERED').length
    const totalValue = b2bSales.reduce((acc, s) => acc + Number(s.total || s.totals?.payable || 0), 0)

    return {
      total: b2bSales.length,
      pending,
      approved,
      dispatched,
      delivered,
      totalValue
    }
  }, [b2bSales])

  return (
    <div className="b2b-page-shell">
      <Navbar />

      <div className="b2b-page-wrap">
        <div className="b2b-hero-card">
          <div className="b2b-hero-left">
            <span className="b2b-hero-badge">Wholesale Dashboard</span>
            <h1 className="b2b-hero-title">B2B Orders</h1>
            <p className="b2b-hero-subtitle">
              Review bulk inquiries, approve payments, dispatch confirmed orders, and track every wholesale request with a cleaner and more premium layout.
            </p>
          </div>

          <div className="b2b-hero-right">
            <button className="b2b-refresh-btn" onClick={fetchB2BSales}>
              {loading ? 'Refreshing...' : 'Refresh list'}
            </button>
          </div>
        </div>

        <div className="b2b-stats-grid">
          <div className="b2b-stat-card">
            <span className="b2b-stat-label">Total Orders</span>
            <span className="b2b-stat-value">{loading ? '...' : stats.total}</span>
          </div>
          <div className="b2b-stat-card pending">
            <span className="b2b-stat-label">Pending</span>
            <span className="b2b-stat-value">{loading ? '...' : stats.pending}</span>
          </div>
          <div className="b2b-stat-card approved">
            <span className="b2b-stat-label">Approved</span>
            <span className="b2b-stat-value">{loading ? '...' : stats.approved}</span>
          </div>
          <div className="b2b-stat-card dispatched">
            <span className="b2b-stat-label">Dispatched</span>
            <span className="b2b-stat-value">{loading ? '...' : stats.dispatched}</span>
          </div>
          <div className="b2b-stat-card delivered">
            <span className="b2b-stat-label">Delivered</span>
            <span className="b2b-stat-value">{loading ? '...' : stats.delivered}</span>
          </div>
        </div>

        <div className="b2b-summary-ribbon">
          <div className="b2b-summary-block">
            <span className="b2b-summary-label">Pending Inquiries</span>
            <span className="b2b-summary-value">{loading ? 'Loading...' : `${stats.pending} order(s)`}</span>
          </div>
          <div className="b2b-summary-divider" />
          <div className="b2b-summary-block">
            <span className="b2b-summary-label">Total B2B Value</span>
            <span className="b2b-summary-value accent">{fmt(stats.totalValue)}</span>
          </div>
        </div>

        <div className="b2b-table-card">
          <div className="b2b-table-headbar">
            <div>
              <h2 className="b2b-table-title">Wholesale Requests</h2>
              <p className="b2b-table-subtitle">Manage all business orders with quick actions and item-level review.</p>
            </div>
            <div className="b2b-table-count">{loading ? 'Loading...' : `${b2bSales.length} records`}</div>
          </div>

          {loading ? (
            <div className="b2b-loader-wrap">
              <div className="b2b-loader-spinner" />
              <span className="b2b-loader-text">Fetching wholesale orders</span>
            </div>
          ) : b2bSales.length === 0 ? (
            <div className="b2b-empty-wrap">
              <div className="b2b-empty-icon" />
              <h3 className="b2b-empty-title">No B2B orders found</h3>
              <p className="b2b-empty-text">Wholesale inquiries will appear here once placed.</p>
            </div>
          ) : (
            <div className="b2b-table-scroller">
              <table className="b2b-orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th className="align-right">Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>View</th>
                    <th>Manual Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {b2bSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div className="b2b-order-cell">
                          <span className="b2b-order-id">#{sale.id.slice(0, 8)}</span>
                          <span className="b2b-order-date">{new Date(sale.created_at).toLocaleDateString('en-IN')}</span>
                        </div>
                      </td>

                      <td>
                        <div className="b2b-customer-cell">
                          <span className="b2b-customer-name">{sale.customer_name || 'B2B User'}</span>
                          <span className="b2b-customer-email">{sale.customer_email || '-'}</span>
                        </div>
                      </td>

                      <td className="align-right">
                        <span className="b2b-amount-text">{fmt(sale.total || sale.totals?.payable)}</span>
                      </td>

                      <td>
                        <span className={`b2b-status-pill b2b-status-${(sale.status || '').toLowerCase()}`}>
                          {sale.status}
                        </span>
                      </td>

                      <td>
                        <span className="b2b-payment-pill">{sale.payment_status}</span>
                      </td>

                      <td>
                        <button className="b2b-view-btn" onClick={() => openOrderDetails(sale)}>
                          View Items
                        </button>
                      </td>

                      <td>
                        {actionLoading === sale.id ? (
                          <span className="b2b-updating-text">Updating...</span>
                        ) : (
                          <div className="b2b-action-row">
                            {sale.status === 'B2B_PENDING' && (
                              <>
                                <button
                                  className="b2b-action-btn success"
                                  onClick={() => handleUpdateStatus(sale.id, 'APPROVED', null)}
                                >
                                  Approve
                                </button>
                                <button
                                  className="b2b-action-btn danger"
                                  onClick={() => handleUpdateStatus(sale.id, 'CANCELLED', 'FAILED')}
                                >
                                  Decline
                                </button>
                              </>
                            )}

                            {sale.status === 'APPROVED' && sale.payment_status === 'PENDING' && (
                              <button
                                className="b2b-action-btn success"
                                onClick={() => handleUpdateStatus(sale.id, null, 'PAID')}
                              >
                                Mark Paid
                              </button>
                            )}

                            {sale.status === 'APPROVED' && sale.payment_status === 'PAID' && (
                              <button
                                className="b2b-action-btn info"
                                onClick={() => handleUpdateStatus(sale.id, 'DISPATCHED', null)}
                              >
                                Dispatch
                              </button>
                            )}

                            {sale.status === 'DISPATCHED' && (
                              <button
                                className="b2b-action-btn solid-success"
                                onClick={() => handleUpdateStatus(sale.id, 'DELIVERED', null)}
                              >
                                Delivered
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className="b2b-modal-backdrop" onClick={closeOrderDetails}>
          <div className="b2b-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="b2b-modal-header">
              <div className="b2b-modal-heading">
                <span className="b2b-modal-badge">Bulk Request</span>
                <h3 className="b2b-modal-title">#{selectedOrder.id.slice(0, 8)}</h3>
                <p className="b2b-modal-subtitle">
                  {selectedOrder.customer_name || 'B2B User'} , {selectedOrder.customer_email || '-'}
                </p>
              </div>

              <button className="b2b-close-btn" onClick={closeOrderDetails}>
                Close
              </button>
            </div>

            <div className="b2b-modal-topstats">
              <div className="b2b-modal-stat">
                <span className="b2b-modal-stat-label">Order Status</span>
                <span className={`b2b-status-pill b2b-status-${(selectedOrder.status || '').toLowerCase()}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <div className="b2b-modal-stat">
                <span className="b2b-modal-stat-label">Payment</span>
                <span className="b2b-payment-pill">{selectedOrder.payment_status}</span>
              </div>
              <div className="b2b-modal-stat">
                <span className="b2b-modal-stat-label">Order Value</span>
                <span className="b2b-modal-amount">{fmt(selectedOrder.total || selectedOrder.totals?.payable)}</span>
              </div>
            </div>

            <div className="b2b-items-section">
              <div className="b2b-items-header">
                <h4 className="b2b-items-title">Requested Items</h4>
                <span className="b2b-items-count">{itemsLoading ? 'Loading...' : `${orderItems.length} item(s)`}</span>
              </div>

              <div className="b2b-items-grid">
                {itemsLoading ? (
                  <div className="b2b-inline-text">Loading items...</div>
                ) : orderItems.length > 0 ? (
                  orderItems.map((it, i) => (
                    <div className="b2b-item-card" key={i}>
                      <div className="b2b-item-media">
                        {it.image_url ? <img src={it.image_url} alt="product" /> : <div className="b2b-item-placeholder" />}
                      </div>

                      <div className="b2b-item-body">
                        <div className="b2b-item-row">
                          <span className="b2b-item-label">Name</span>
                          <span className="b2b-item-value">{it.product_name || '-'}</span>
                        </div>
                        <div className="b2b-item-row">
                          <span className="b2b-item-label">Size / Colour</span>
                          <span className="b2b-item-value">
                            {it.size || '-'} / {it.colour || '-'}
                          </span>
                        </div>
                        <div className="b2b-item-row">
                          <span className="b2b-item-label">Quantity</span>
                          <span className="b2b-item-value qty">{it.qty}</span>
                        </div>
                        <div className="b2b-item-row">
                          <span className="b2b-item-label">Price</span>
                          <span className="b2b-item-value strong">{fmt(it.price)}/ea</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="b2b-inline-text">No items found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}