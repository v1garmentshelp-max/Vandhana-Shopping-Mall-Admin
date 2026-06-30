import React, { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'
import './POS.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE) ||
  process.env.REACT_APP_API_BASE_URL ||
  DEFAULT_API_BASE

const API_BASE = API_BASE_RAW.replace(/\/+$/, '').replace(/\/api$/, '')
const DEFAULT_BRANCH_ID = 3

const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const str = (v) => String(v == null ? '' : v).trim()

const money = (v) =>
  num(v).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const toArray = (x) => {
  if (Array.isArray(x)) return x
  if (Array.isArray(x?.data)) return x.data
  if (Array.isArray(x?.rows)) return x.rows
  if (Array.isArray(x?.items)) return x.items
  if (Array.isArray(x?.stock)) return x.stock
  if (Array.isArray(x?.stocks)) return x.stocks
  if (Array.isArray(x?.products)) return x.products
  return []
}

const normalizeProduct = (v, code) => {
  if (!v) return null

  const variantId = num(v.variant_id ?? v.variantId ?? v.id ?? v.product_id)
  const eanCode = str(v.ean_code ?? v.ean ?? v.barcode ?? v.barcode_value ?? code)
  const price = num(v.sale_price ?? v.final_price_b2c ?? v.retail_price ?? v.final_price ?? v.price ?? v.mrp)
  const mrp = num(v.mrp ?? v.original_price_b2c ?? v.originalPrice ?? v.price ?? price)
  const stockValue = v.on_hand ?? v.stock ?? v.qty ?? v.quantity
  const stock = stockValue == null || stockValue === '' ? null : num(stockValue)

  if (!variantId || !eanCode) return null

  return {
    variant_id: variantId,
    ean_code: eanCode,
    name: str(v.product_name ?? v.name ?? v.title ?? 'Product'),
    brand: str(v.brand_name ?? v.brand ?? ''),
    size: str(v.size ?? v.selected_size ?? ''),
    colour: str(v.colour ?? v.color ?? v.selected_color ?? ''),
    price: price || mrp,
    mrp: mrp || price,
    image_url: str(v.image_url ?? v.image ?? v.thumbnail ?? ''),
    stock,
    qty: 1
  }
}

export default function POS() {
  const { token } = useAuth()
  const branchId = DEFAULT_BRANCH_ID
  const eanInputRef = useRef(null)

  const [saleId, setSaleId] = useState(uuid())
  const [ean, setEan] = useState('')
  const [items, setItems] = useState([])
  const [toast, setToast] = useState('')
  const [searching, setSearching] = useState(false)
  const [paying, setPaying] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentRef, setPaymentRef] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const authToken =
    token ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    ''

  useEffect(() => {
    localStorage.setItem('pos_branch_id', String(DEFAULT_BRANCH_ID))
    eanInputRef.current?.focus()
  }, [])

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }),
    [authToken]
  )

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const totals = useMemo(() => {
    let qty = 0
    let subtotal = 0
    let mrpTotal = 0

    for (const it of items) {
      const itemQty = num(it.qty)
      qty += itemQty
      subtotal += itemQty * num(it.price)
      mrpTotal += itemQty * num(it.mrp || it.price)
    }

    const discount = Math.max(0, mrpTotal - subtotal)

    return {
      qty,
      subtotal,
      mrpTotal,
      discount,
      total: subtotal
    }
  }, [items])

  const apiGet = async (path) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
      credentials: 'omit',
      mode: 'cors'
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`)
    }

    return data
  }

  const apiPost = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      credentials: 'omit',
      mode: 'cors',
      body: JSON.stringify(body)
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`)
    }

    return data
  }

  const findProductByStock = async (code) => {
    const data = await apiGet(`/api/branch/${branchId}/stock`)
    const list = toArray(data)
    const found = list.find((x) => str(x.ean_code ?? x.ean ?? x.barcode ?? x.barcode_value) === code)
    return normalizeProduct(found, code)
  }

  const findProductByBarcode = async (code) => {
    const paths = [
      `/api/barcodes/${encodeURIComponent(code)}`,
      `/api/products/barcode/${encodeURIComponent(code)}`,
      `/api/products/by-barcode/${encodeURIComponent(code)}`,
      `/api/inventory/scan?branch_id=${branchId}&ean_code=${encodeURIComponent(code)}`
    ]

    for (const path of paths) {
      try {
        const data = await apiGet(path)
        const product = normalizeProduct(Array.isArray(data) ? data[0] : data?.data || data?.product || data?.variant || data?.item || data, code)
        if (product) return product
      } catch {}
    }

    try {
      const product = await findProductByStock(code)
      if (product) return product
    } catch {}

    return null
  }

  const scanFlow = async (code) => {
    const trimmed = str(code)
    if (!trimmed) return

    setSearching(true)
    setError('')

    try {
      const product = await findProductByBarcode(trimmed)

      if (!product) {
        showToast('Product not found')
        return
      }

      if (product.stock != null && product.stock <= 0) {
        showToast('Product is out of stock')
        return
      }

      setItems((prev) => {
        const ix = prev.findIndex((p) => p.variant_id === product.variant_id)

        if (ix >= 0) {
          const existing = prev[ix]
          const nextQty = existing.qty + 1

          if (existing.stock != null && nextQty > existing.stock) {
            showToast(`Only ${existing.stock} units available`)
            return prev
          }

          const updated = [...prev]
          updated[ix] = { ...updated[ix], qty: nextQty }
          return updated
        }

        return [...prev, product]
      })

      showToast('Added')
    } catch (e) {
      const msg = e?.message || 'Scan failed'
      setError(msg)
      showToast(msg)
    } finally {
      setSearching(false)
      setEan('')
      eanInputRef.current?.focus()
    }
  }

  const handleManualAdd = () => {
    if (!ean) return
    scanFlow(ean)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleManualAdd()
    }
  }

  const addOneMore = (row) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.variant_id !== row.variant_id) return p
        const nextQty = p.qty + 1

        if (p.stock != null && nextQty > p.stock) {
          showToast(`Only ${p.stock} units available`)
          return p
        }

        return { ...p, qty: nextQty }
      })
    )
  }

  const removeOne = (row) => {
    setItems((prev) =>
      prev
        .map((p) =>
          p.variant_id === row.variant_id ? { ...p, qty: Math.max(0, p.qty - 1) } : p
        )
        .filter((p) => p.qty > 0)
    )
  }

  const newSale = () => {
    setItems([])
    setSaleId(uuid())
    setPaymentRef('')
    setPaymentMethod('CASH')
    setError('')
    setPaying(false)
    setSuccessOpen(false)
    setEan('')
    eanInputRef.current?.focus()
  }

  const proceedToCheckout = () => {
    if (!items.length) return
    setPaying(true)
  }

  const markPaymentPaid = async (backendSaleId) => {
    if (!backendSaleId) return

    const paths = ['/api/sales/web/set-payment-status', '/api/orders/web/set-payment-status']

    for (const path of paths) {
      try {
        await apiPost(path, {
          sale_id: backendSaleId,
          status: 'PAID'
        })
        return
      } catch {}
    }
  }

  const confirmPayment = async () => {
    if (!items.length || confirming) return

    setError('')
    setConfirming(true)

    try {
      const payload = {
        sale_id: saleId,
        branch_id: branchId,
        branchId,
        selected_branch_id: branchId,
        selectedBranchId: branchId,
        pickup_branch_id: branchId,
        payment: {
          method: paymentMethod,
          ref: paymentRef || null,
          amount: totals.total
        },
        payment_method: `POS_${paymentMethod}`,
        payment_status: 'PENDING',
        payment_ref: paymentRef || null,
        source: 'POS',
        customer_name: 'POS Customer',
        customer_email: 'pos@vandana.local',
        login_email: 'pos@vandana.local',
        customer_mobile: '',
        shipping_address: {
          full_name: 'POS Customer',
          phone: '',
          address: 'Branch POS Counter',
          city: 'Srikakulam',
          state: 'Andhra Pradesh',
          pincode: '532001'
        },
        totals: {
          bagTotal: totals.mrpTotal || totals.total,
          discountTotal: totals.discount,
          couponPct: 0,
          couponDiscount: 0,
          convenience: 0,
          giftWrap: 0,
          payable: totals.total
        },
        items: items.map((it) => ({
          variant_id: it.variant_id,
          product_id: it.variant_id,
          ean_code: it.ean_code,
          barcode_value: it.ean_code,
          qty: it.qty,
          price: it.price,
          mrp: it.mrp || it.price,
          size: it.size || null,
          colour: it.colour || null,
          image_url: it.image_url || null,
          name: it.name
        })),
        client_action_id: uuid()
      }

      const paths = ['/api/sales/web/place', '/api/orders/web/place']
      let lastError = null
      let result = null

      for (const path of paths) {
        try {
          result = await apiPost(path, payload)
          break
        } catch (e) {
          lastError = e
        }
      }

      if (!result) {
        throw lastError || new Error('Payment failed')
      }

      const backendSaleId = result?.id || result?.sale_id || result?.sale?.id

      if (backendSaleId) {
        await markPaymentPaid(backendSaleId)
      }

      setPaying(false)
      setSuccessOpen(true)
      setItems([])
      setSaleId(uuid())
      setPaymentRef('')
      setPaymentMethod('CASH')
    } catch (e) {
      const msg = e?.message || 'Payment failed'
      setError(msg)
      showToast(msg)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="pos-page">
      <Navbar />

      <div className="pos-shell">
        <div className="pos-hero">
          <div className="pos-hero-text">
            <span className="pos-badge">Store Billing</span>
            <h1 className="pos-title">Point of Sale</h1>
            <p className="pos-subtitle">
              Scan products, review the cart, and complete billing with a cleaner, brighter, and more polished layout.
            </p>
          </div>
          <div className="pos-hero-meta">
            <div className="pos-meta-card">
              <span className="pos-meta-label">Branch</span>
              <span className="pos-meta-value">{branchId}</span>
            </div>
            <div className="pos-meta-card">
              <span className="pos-meta-label">Sale ID</span>
              <span className="pos-meta-value">{saleId.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        <div className="pos-main-grid">
          <div className="pos-left">
            <div className="pos-panel">
              <div className="pos-panel-head">
                <h2>Scan Product</h2>
                <span>{searching ? 'Searching...' : 'Ready'}</span>
              </div>

              <div className="scan-row">
                <input
                  ref={eanInputRef}
                  type="text"
                  placeholder="Scan EAN or type manually"
                  value={ean}
                  onChange={(e) => setEan(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={onKeyDown}
                />
                <button className="btn gold" onClick={handleManualAdd} disabled={searching || !ean}>
                  {searching ? 'Adding...' : 'Add'}
                </button>
              </div>

              {error ? <div className="error-text">{error}</div> : null}
            </div>

            <div className="pos-panel cart-panel">
              <div className="pos-panel-head">
                <h2>Cart Items</h2>
                <span>{items.length} product{items.length === 1 ? '' : 's'}</span>
              </div>

              <div className="cart">
                <div className="cart-head">
                  <div>Item</div>
                  <div>Details</div>
                  <div className="right">Price</div>
                  <div className="center">Qty</div>
                  <div className="right">Total</div>
                </div>

                {items.length === 0 ? (
                  <div className="cart-empty">Scan or type an EAN to add items</div>
                ) : (
                  items.map((it) => (
                    <div className="cart-row" key={it.variant_id}>
                      <div className="thumb">
                        {it.image_url ? <img src={it.image_url} alt={it.name} /> : <div className="thumb-ph" />}
                      </div>

                      <div className="info">
                        <div className="name">{it.name}</div>
                        <div className="meta">
                          <span>{it.brand || '-'}</span>
                          <span>Size: {it.size || '-'}</span>
                          <span>Color: {it.colour || '-'}</span>
                          <span>EAN: {it.ean_code}</span>
                          {it.stock != null ? <span>Stock: {it.stock}</span> : null}
                        </div>
                      </div>

                      <div className="right price-cell">₹{money(it.price)}</div>

                      <div className="center qty">
                        <button className="btn qty-btn" onClick={() => removeOne(it)}>-1</button>
                        <div className="qty-box">{it.qty}</div>
                        <button className="btn qty-btn" onClick={() => addOneMore(it)}>+1</button>
                      </div>

                      <div className="right row-total">₹{money(it.qty * num(it.price))}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pos-right">
            <div className="pos-summary-card">
              <div className="pos-panel-head">
                <h2>Bill Summary</h2>
              </div>

              <div className="summary-list">
                <div className="summary-row">
                  <span>Total Items</span>
                  <strong>{totals.qty}</strong>
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>₹{money(totals.total)}</strong>
                </div>
                <div className="summary-row grand">
                  <span>Grand Total</span>
                  <strong>₹{money(totals.total)}</strong>
                </div>
              </div>

              <div className="summary-actions">
                <button className="btn ghost" onClick={newSale}>
                  New Sale
                </button>
                <button className="btn gold" onClick={proceedToCheckout} disabled={!items.length}>
                  Proceed to Checkout
                </button>
              </div>
            </div>

            <div className="pos-note-card">
              <h3>Quick Tips</h3>
              <ul>
                <li>Adding items does not reduce stock</li>
                <li>Stock reduces only after payment confirmation</li>
                <li>Use +1 and -1 to adjust quantity instantly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {paying && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Payment</div>

            <div className="payment-grid">
              <button
                className={`pay-chip ${paymentMethod === 'CASH' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('CASH')}
              >
                Cash
              </button>
              <button
                className={`pay-chip ${paymentMethod === 'UPI' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('UPI')}
              >
                UPI
              </button>
              <button
                className={`pay-chip ${paymentMethod === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('ONLINE')}
              >
                Online
              </button>
            </div>

            <input
              className="pay-input"
              placeholder="Reference (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />

            <div className="modal-total-box">
              <span>Payable Amount</span>
              <strong>₹{money(totals.total)}</strong>
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setPaying(false)} disabled={confirming}>
                Back
              </button>
              <button className="btn gold" onClick={confirmPayment} disabled={confirming}>
                {confirming ? 'Confirming...' : 'Confirm'}
              </button>
            </div>

            {error ? <div className="error-text">{error}</div> : null}
          </div>
        </div>
      )}

      {successOpen && (
        <div className="modal-overlay">
          <div className="modal success">
            <div className="modal-title">Transaction Completed</div>
            <div className="success-text">Payment successful. Ready for next customer.</div>
            <div className="modal-actions">
              <button
                className="btn gold"
                onClick={() => {
                  setSuccessOpen(false)
                  eanInputRef.current?.focus()
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="pos-toast">{toast}</div>}
    </div>
  )
}