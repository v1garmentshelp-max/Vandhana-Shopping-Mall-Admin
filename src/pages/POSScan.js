import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './NavbarAdmin'
import BarcodeScanner from './BarcodeScanner'
import useOfflineQueue from './useOfflineQueue'
import { useAuth } from './AdminAuth'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  process.env.REACT_APP_API_BASE_URL ||
  DEFAULT_API_BASE

const API_BASE = API_BASE_RAW.replace(/\/+$/, '').replace(/\/api$/, '')
const DEFAULT_BRANCH_ID = 3

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function toArray(x) {
  if (Array.isArray(x)) return x
  if (Array.isArray(x?.data)) return x.data
  if (Array.isArray(x?.rows)) return x.rows
  if (Array.isArray(x?.items)) return x.items
  if (Array.isArray(x?.stock)) return x.stock
  if (Array.isArray(x?.stocks)) return x.stocks
  if (Array.isArray(x?.products)) return x.products
  return []
}

function toObject(x) {
  if (!x) return null
  if (Array.isArray(x)) return x[0] || null
  if (x.data && !Array.isArray(x.data)) return x.data
  if (x.product) return x.product
  if (x.variant) return x.variant
  if (x.item) return x.item
  return x
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function str(v) {
  return String(v == null ? '' : v).trim()
}

function money(v) {
  return num(v).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

function normalizePaymentMethod(method) {
  const m = str(method).toLowerCase()
  if (m === 'upi') return 'POS_UPI'
  if (m === 'card') return 'POS_CARD'
  return 'POS_CASH'
}

function normalizeProduct(p, barcode) {
  if (!p) return null

  const variantId = num(p.variant_id ?? p.variantId ?? p.id ?? p.product_id)
  const name = str(p.product_name ?? p.name ?? p.title ?? p.product ?? 'Product')
  const brand = str(p.brand_name ?? p.brand ?? '')
  const size = str(p.size ?? p.selected_size ?? '')
  const colour = str(p.colour ?? p.color ?? p.selected_color ?? '')
  const ean = str(p.ean_code ?? p.ean ?? p.barcode ?? p.barcode_value ?? barcode)
  const mrp = num(p.mrp ?? p.original_price_b2c ?? p.originalPrice ?? p.price)
  const price = num(p.sale_price ?? p.final_price_b2c ?? p.retail_price ?? p.final_price ?? p.price ?? p.mrp)
  const stockValue = p.on_hand ?? p.stock ?? p.qty ?? p.quantity
  const stock = stockValue == null || stockValue === '' ? null : num(stockValue)
  const imageUrl = str(p.image_url ?? p.image ?? p.thumbnail ?? '')

  if (!variantId || !ean) return null

  return {
    id: uuid(),
    productId: variantId,
    variant_id: variantId,
    name: brand ? `${brand} ${name}` : name,
    brand,
    price: price || mrp,
    mrp: mrp || price,
    barcode: ean,
    ean_code: ean,
    size,
    colour,
    stock,
    image_url: imageUrl,
    qty: 1
  }
}

export default function POSScan() {
  const { token } = useAuth()
  const [saleId, setSaleId] = useState(localStorage.getItem('pos_sale_id') || uuid())
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState({ method: 'cash', amount: '', ref: '' })
  const { queue, enqueue } = useOfflineQueue()
  const lastScanRef = useRef({ barcode: '', time: 0 })

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
  }, [])

  useEffect(() => {
    localStorage.setItem('pos_sale_id', saleId)
  }, [saleId])

  const total = useMemo(() => {
    return lines.reduce((a, b) => a + num(b.price) * Math.max(1, num(b.qty)), 0)
  }, [lines])

  const totalMrp = useMemo(() => {
    return lines.reduce((a, b) => a + num(b.mrp || b.price) * Math.max(1, num(b.qty)), 0)
  }, [lines])

  const discountTotal = useMemo(() => {
    return Math.max(0, totalMrp - total)
  }, [totalMrp, total])

  const request = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(options.headers || {})
        },
        credentials: 'omit',
        mode: 'cors'
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const message = data?.message || data?.error || `Request failed with status ${res.status}`
        throw new Error(message)
      }

      return data
    },
    [authToken]
  )

  const getJson = useCallback(
    async (path) => {
      return request(path, { method: 'GET' })
    },
    [request]
  )

  const postJson = useCallback(
    async (path, body) => {
      return request(path, {
        method: 'POST',
        body: JSON.stringify(body)
      })
    },
    [request]
  )

  const findInBranchStock = useCallback(
    async (barcode) => {
      const data = await getJson(`/api/branch/${DEFAULT_BRANCH_ID}/stock`)
      const list = toArray(data)
      const code = str(barcode)

      return (
        list.find((x) => str(x.ean_code ?? x.ean ?? x.barcode ?? x.barcode_value) === code) ||
        list.find((x) => str(x.ean_code ?? x.ean ?? x.barcode ?? x.barcode_value).toLowerCase() === code.toLowerCase()) ||
        null
      )
    },
    [getJson]
  )

  const lookupFromBarcodeApis = useCallback(
    async (barcode) => {
      const paths = [
        `/api/barcodes/${encodeURIComponent(barcode)}`,
        `/api/products/barcode/${encodeURIComponent(barcode)}`,
        `/api/products/by-barcode/${encodeURIComponent(barcode)}`
      ]

      for (const path of paths) {
        try {
          const data = await getJson(path)
          const obj = toObject(data)
          const product = normalizeProduct(obj, barcode)
          if (product) return product
        } catch {}
      }

      return null
    },
    [getJson]
  )

  const addOrIncrement = useCallback((line) => {
    setLines((prev) => {
      const idx = prev.findIndex((x) => String(x.productId) === String(line.productId) || String(x.barcode) === String(line.barcode))

      if (idx >= 0) {
        const copy = [...prev]
        const currentQty = num(copy[idx].qty) || 1
        const maxStock = copy[idx].stock == null ? null : num(copy[idx].stock)

        if (maxStock != null && currentQty + 1 > maxStock) {
          setStatus(`Only ${maxStock} units available`)
          return prev
        }

        copy[idx] = { ...copy[idx], qty: currentQty + 1 }
        setStatus('Quantity updated')
        return copy
      }

      if (line.stock != null && num(line.stock) <= 0) {
        setStatus('Product is out of stock')
        return prev
      }

      setStatus('Added')
      return [...prev, line]
    })
  }, [])

  const lookupBarcode = useCallback(
    async (value) => {
      const barcode = str(value)

      if (!barcode) return

      const now = Date.now()
      if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.time < 1200) return
      lastScanRef.current = { barcode, time: now }

      setLoading(true)
      setStatus('Looking up...')

      try {
        let product = null

        try {
          const stockItem = await findInBranchStock(barcode)
          product = normalizeProduct(stockItem, barcode)
        } catch {}

        if (!product) {
          product = await lookupFromBarcodeApis(barcode)
        }

        if (!product) {
          setStatus(`No product found for ${barcode}`)
          return
        }

        addOrIncrement(product)
      } catch (e) {
        setStatus(e?.message || 'Lookup failed')
      } finally {
        setLoading(false)
        setTimeout(() => setStatus(''), 1800)
      }
    },
    [addOrIncrement, findInBranchStock, lookupFromBarcodeApis]
  )

  const submitManualBarcode = () => {
    const code = str(manualBarcode)
    if (!code) return
    setManualBarcode('')
    lookupBarcode(code)
  }

  const changeQty = (lineId, delta) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l

        const currentQty = num(l.qty) || 1
        const nextQty = Math.max(1, currentQty + delta)
        const maxStock = l.stock == null ? null : num(l.stock)

        if (maxStock != null && nextQty > maxStock) {
          setStatus(`Only ${maxStock} units available`)
          setTimeout(() => setStatus(''), 1600)
          return l
        }

        return { ...l, qty: nextQty }
      })
    )
  }

  const removeLine = (lineId) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  const startNewSale = () => {
    const id = uuid()
    setSaleId(id)
    localStorage.setItem('pos_sale_id', id)
    setLines([])
    setPayment({ method: 'cash', amount: '', ref: '' })
    setStatus('')
  }

  const markPaymentPaid = async (backendSaleId) => {
    await postJson('/api/sales/web/set-payment-status', {
      sale_id: backendSaleId,
      status: 'PAID'
    })
  }

  async function confirmSale() {
    if (!lines.length) {
      setStatus('Scan at least one item')
      return
    }

    const invalidLine = lines.find((l) => l.stock != null && num(l.qty) > num(l.stock))

    if (invalidLine) {
      setStatus(`Only ${invalidLine.stock} units available for ${invalidLine.name}`)
      return
    }

    setLoading(true)
    setStatus('Confirming sale...')

    const paidAmount = num(payment.amount) || total
    const paymentMethod = normalizePaymentMethod(payment.method)

    const payload = {
      source: 'POS',
      pos_reference: saleId,
      branch_id: DEFAULT_BRANCH_ID,
      branchId: DEFAULT_BRANCH_ID,
      selected_branch_id: DEFAULT_BRANCH_ID,
      selectedBranchId: DEFAULT_BRANCH_ID,
      pickup_branch_id: DEFAULT_BRANCH_ID,
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
      payment_method: paymentMethod,
      payment_status: 'PENDING',
      payment_ref: str(payment.ref),
      totals: {
        bagTotal: totalMrp || total,
        discountTotal,
        couponPct: 0,
        couponDiscount: 0,
        convenience: 0,
        giftWrap: 0,
        paidAmount,
        payable: total
      },
      items: lines.map((l) => ({
        variant_id: num(l.variant_id || l.productId),
        product_id: num(l.variant_id || l.productId),
        qty: Math.max(1, num(l.qty)),
        price: num(l.price),
        mrp: num(l.mrp || l.price),
        size: l.size || null,
        colour: l.colour || null,
        image_url: l.image_url || null,
        ean_code: l.ean_code || l.barcode,
        barcode_value: l.ean_code || l.barcode,
        name: l.name
      }))
    }

    try {
      const placed = await postJson('/api/sales/web/place', payload)
      const backendSaleId = placed?.id || placed?.sale_id || placed?.sale?.id

      if (backendSaleId) {
        try {
          await markPaymentPaid(backendSaleId)
        } catch {}
      }

      setStatus('Sale confirmed')
      startNewSale()
    } catch (e) {
      const actionId = uuid()
      enqueue({
        id: actionId,
        url: '/api/sales/web/place',
        method: 'POST',
        body: payload
      })
      setStatus(e?.message || 'Sale confirmation failed')
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(''), 2600)
    }
  }

  return (
    <div className="pos-scan-page">
      <Navbar />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
        <h2>Branch POS</h2>
        <p style={{ opacity: 0.8, marginTop: -6 }}>Scan items, collect payment, then confirm the sale.</p>

        <div className="pos-top" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
          <div className="card" style={{ padding: 12 }}>
            <label>Branch ID</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input value={String(DEFAULT_BRANCH_ID)} readOnly />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>POS Reference</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={saleId} readOnly />
                <button type="button" onClick={startNewSale}>New Sale</button>
              </div>
              <small style={{ opacity: 0.7 }}>Queued actions: {queue.length}</small>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <label>Scan / Enter Barcode</label>
            <BarcodeScanner onDetected={lookupBarcode} />

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManualBarcode()
                }}
                placeholder="Enter barcode manually"
              />
              <button type="button" disabled={loading || !manualBarcode.trim()} onClick={submitManualBarcode}>
                Add
              </button>
            </div>

            {status ? <div style={{ marginTop: 8, color: '#ffd84d' }}>{status}</div> : null}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3>Items</h3>

          <table style={{ width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Size</th>
                <th>Colour</th>
                <th>Stock</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.barcode}</td>
                  <td>{l.size || '-'}</td>
                  <td>{l.colour || '-'}</td>
                  <td>{l.stock == null ? '-' : money(l.stock)}</td>
                  <td>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button type="button" onClick={() => changeQty(l.id, -1)}>-</button>
                      <span>{l.qty}</span>
                      <button type="button" onClick={() => changeQty(l.id, 1)}>+</button>
                    </div>
                  </td>
                  <td>₹{money(l.price)}</td>
                  <td>₹{money(num(l.price) * Math.max(1, num(l.qty)))}</td>
                  <td>
                    <button type="button" onClick={() => removeLine(l.id)}>Remove</button>
                  </td>
                </tr>
              ))}

              {!lines.length ? (
                <tr>
                  <td colSpan="9" style={{ padding: 12, color: '#999' }}>No items yet. Scan a barcode.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, opacity: 0.7 }}>Total</div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>₹{money(total)}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <h3>Payment & Confirm</h3>

          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            <select value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>

            <input
              type="number"
              placeholder="Amount"
              value={payment.amount}
              onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
            />

            <input
              type="text"
              placeholder="Ref / UTR"
              value={payment.ref}
              onChange={(e) => setPayment((p) => ({ ...p, ref: e.target.value }))}
            />
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" disabled={loading || !lines.length} onClick={confirmSale}>
              {loading ? 'Please wait...' : 'Confirm Sale'}
            </button>

            <button type="button" disabled={loading || !lines.length} onClick={startNewSale}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}