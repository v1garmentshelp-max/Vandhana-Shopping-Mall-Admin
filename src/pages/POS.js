import React, { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'
import { apiGet, apiPost } from './api'
import './POS.css'

const DEFAULT_BRANCH_ID = 3

const num = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const str = value => String(value ?? '').trim()

const money = value =>
  num(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const normalizeProduct = data => {
  if (!data) return null

  const variantId = num(data.variant_id ?? data.variantId)
  const productId = num(data.product_id ?? data.productId)
  const eanCode = str(
    data.ean_code ??
      data.eanCode ??
      data.barcode ??
      data.barcode_value
  )

  const availableQty = num(
    data.available_qty ??
      data.availableQty ??
      data.available ??
      data.stock
  )

  const mrp = num(data.mrp)

  const price = num(
    data.sale_price ??
      data.salePrice ??
      data.price ??
      data.mrp
  )

  if (!variantId || !productId || !eanCode) {
    return null
  }

  return {
    product_id: productId,
    variant_id: variantId,
    ean_code: eanCode,
    name: str(
      data.product_name ??
        data.productName ??
        data.name ??
        'Product'
    ),
    brand: str(
      data.brand_name ??
        data.brandName ??
        data.brand
    ),
    design_code: str(
      data.design_code ??
        data.designCode
    ),
    pattern_code: str(
      data.pattern_code ??
        data.patternCode
    ),
    pattern_type: str(
      data.pattern_type ??
        data.patternType
    ),
    size: str(data.size),
    colour: str(
      data.colour ??
        data.color
    ),
    mrp: mrp || price,
    price: price || mrp,
    image_url: str(
      data.image_url ??
        data.imageUrl ??
        data.image
    ),
    on_hand: num(
      data.on_hand ??
        data.onHand
    ),
    reserved: num(data.reserved),
    available_qty: availableQty,
    qty: 1
  }
}

export default function POS() {
  const { user } = useAuth()

  const inputRef = useRef(null)
  const messageTimerRef = useRef(null)

  const branchId = useMemo(() => {
    const userBranch = num(
      user?.branch_id ??
        user?.branchId
    )

    if (userBranch > 0) {
      return userBranch
    }

    const storedBranch =
      typeof window !== 'undefined'
        ? num(
            window.localStorage.getItem(
              'pos_branch_id'
            )
          )
        : 0

    return storedBranch > 0
      ? storedBranch
      : DEFAULT_BRANCH_ID
  }, [user])

  const [ean, setEan] = useState('')
  const [items, setItems] = useState([])
  const [lastScanned, setLastScanned] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const [paymentMethod, setPaymentMethod] =
    useState('POS_CASH')

  const [paymentRef, setPaymentRef] =
    useState('')

  const [customerName, setCustomerName] =
    useState('')

  const [customerMobile, setCustomerMobile] =
    useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'pos_branch_id',
        String(branchId)
      )
    }

    inputRef.current?.focus()
  }, [branchId])

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current)
      }
    }
  }, [])

  const showMessage = (type, text) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current)
    }

    setMessage({
      type,
      text
    })

    messageTimerRef.current = setTimeout(() => {
      setMessage(null)
    }, 3000)
  }

  const totals = useMemo(() => {
    let quantity = 0
    let mrpTotal = 0
    let payable = 0

    items.forEach(item => {
      const qty = num(item.qty)

      quantity += qty
      mrpTotal += num(item.mrp) * qty
      payable += num(item.price) * qty
    })

    return {
      quantity,
      mrpTotal,
      discount: Math.max(
        mrpTotal - payable,
        0
      ),
      payable
    }
  }, [items])

  const addProductToCart = product => {
    if (!product) return

    if (product.available_qty <= 0) {
      showMessage(
        'error',
        `${product.ean_code} is out of stock`
      )

      return
    }

    setItems(current => {
      const index = current.findIndex(
        item =>
          item.variant_id ===
            product.variant_id &&
          item.ean_code ===
            product.ean_code
      )

      if (index < 0) {
        return [
          ...current,
          {
            ...product,
            qty: 1
          }
        ]
      }

      const existing = current[index]
      const nextQty =
        num(existing.qty) + 1

      if (
        nextQty >
        product.available_qty
      ) {
        showMessage(
          'error',
          `Only ${product.available_qty} unit${
            product.available_qty === 1
              ? ''
              : 's'
          } available for ${product.ean_code}`
        )

        return current
      }

      const updated = [...current]

      updated[index] = {
        ...existing,
        ...product,
        qty: nextQty
      }

      return updated
    })
  }

  const scanBarcode = async rawCode => {
    const code = str(rawCode).replace(
      /\s+/g,
      ''
    )

    if (!code || scanning) {
      return
    }

    setScanning(true)
    setMessage(null)

    try {
      const data = await apiGet(
        '/inventory/scan',
        {
          branch_id: branchId,
          ean_code: code
        }
      )

      const product =
        normalizeProduct(data)

      if (!product) {
        throw new Error(
          'Invalid barcode response'
        )
      }

      if (
        product.ean_code !== code
      ) {
        throw new Error(
          'Barcode response mismatch'
        )
      }

      if (
        product.available_qty <= 0
      ) {
        setLastScanned(product)

        showMessage(
          'error',
          `${product.ean_code} is out of stock`
        )

        return
      }

      setLastScanned(product)
      addProductToCart(product)

      showMessage(
        'success',
        `${product.ean_code} added`
      )
    } catch (error) {
      const payload =
        error?.payload || {}

      if (
        error?.status === 401
      ) {
        showMessage(
          'error',
          'Session expired. Please login again.'
        )
      } else if (
        error?.status === 404
      ) {
        setLastScanned(null)

        showMessage(
          'error',
          `Barcode ${code} not found`
        )
      } else if (
        error?.status === 409
      ) {
        setLastScanned(
          payload?.product
            ? normalizeProduct(
                payload.product
              )
            : null
        )

        showMessage(
          'error',
          payload?.message ||
            `Barcode ${code} is out of stock`
        )
      } else {
        showMessage(
          'error',
          error?.message ||
            'Unable to scan barcode'
        )
      }
    } finally {
      setScanning(false)
      setEan('')

      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }

  const handleSubmit = event => {
    event.preventDefault()

    scanBarcode(ean)
  }

  const changeQty = (
    variantId,
    eanCode,
    delta
  ) => {
    setItems(current =>
      current
        .map(item => {
          if (
            item.variant_id !==
              variantId ||
            item.ean_code !== eanCode
          ) {
            return item
          }

          const nextQty =
            num(item.qty) + delta

          if (nextQty <= 0) {
            return {
              ...item,
              qty: 0
            }
          }

          if (
            nextQty >
            item.available_qty
          ) {
            showMessage(
              'error',
              `Only ${item.available_qty} unit${
                item.available_qty ===
                1
                  ? ''
                  : 's'
              } available for ${item.ean_code}`
            )

            return item
          }

          return {
            ...item,
            qty: nextQty
          }
        })
        .filter(
          item => item.qty > 0
        )
    )
  }

  const removeItem = (
    variantId,
    eanCode
  ) => {
    setItems(current =>
      current.filter(
        item =>
          !(
            item.variant_id ===
              variantId &&
            item.ean_code === eanCode
          )
      )
    )
  }

  const clearSale = () => {
    setItems([])
    setLastScanned(null)
    setCheckoutOpen(false)
    setPaymentMethod('POS_CASH')
    setPaymentRef('')
    setCustomerName('')
    setCustomerMobile('')
    setEan('')

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  const refreshExactCartStock =
    async () => {
      if (!items.length) {
        return false
      }

      const refreshedItems = []

      for (const item of items) {
        try {
          const data = await apiGet(
            '/inventory/scan',
            {
              branch_id: branchId,
              ean_code:
                item.ean_code
            }
          )

          const fresh =
            normalizeProduct(data)

          if (!fresh) {
            showMessage(
              'error',
              `${item.ean_code} could not be verified`
            )

            return false
          }

          if (
            fresh.ean_code !==
            item.ean_code
          ) {
            showMessage(
              'error',
              `Barcode mismatch for ${item.ean_code}`
            )

            return false
          }

          if (
            fresh.available_qty <
            item.qty
          ) {
            setLastScanned(fresh)

            showMessage(
              'error',
              `Only ${fresh.available_qty} unit${
                fresh.available_qty ===
                1
                  ? ''
                  : 's'
              } available for ${fresh.ean_code}`
            )

            return false
          }

          refreshedItems.push({
            ...item,
            ...fresh,
            qty: item.qty
          })
        } catch (error) {
          showMessage(
            'error',
            error?.message ||
              `${item.ean_code} is unavailable`
          )

          return false
        }
      }

      setItems(refreshedItems)

      return true
    }

  const openCheckout = async () => {
    if (
      !items.length ||
      scanning ||
      submitting
    ) {
      return
    }

    const valid =
      await refreshExactCartStock()

    if (valid) {
      setCheckoutOpen(true)
    }
  }

  const confirmSale = async () => {
    if (
      !items.length ||
      submitting
    ) {
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        branch_id: branchId,
        payment_method:
          paymentMethod,
        payment_ref:
          str(paymentRef) || null,
        customer_name:
          str(customerName) || null,
        customer_mobile:
          str(customerMobile) || null,
        items: items.map(item => ({
          product_id:
            item.product_id,
          variant_id:
            item.variant_id,
          ean_code:
            item.ean_code,
          qty: num(item.qty)
        }))
      }

      const result =
        await apiPost(
          '/sales/pos/place',
          payload
        )

      const completedReceipt = {
        sale_id:
          result?.sale_id ??
          result?.id ??
          result?.sale?.id ??
          '',
        quantity:
          totals.quantity,
        total: num(
          result?.total ??
            result?.totals?.payable ??
            totals.payable
        ),
        payment_method:
          result?.payment_method ??
          paymentMethod
      }

      setReceipt(
        completedReceipt
      )

      setItems([])
      setLastScanned(null)
      setCheckoutOpen(false)
      setPaymentMethod('POS_CASH')
      setPaymentRef('')
      setCustomerName('')
      setCustomerMobile('')
      setEan('')

      showMessage(
        'success',
        'Sale completed successfully'
      )
    } catch (error) {
      const payload =
        error?.payload || {}

      if (
        error?.status === 409 ||
        payload?.code ===
          'OUT_OF_STOCK'
      ) {
        const failedEan = str(
          payload?.ean_code ??
            payload?.item
              ?.ean_code
        )

        showMessage(
          'error',
          failedEan
            ? `${failedEan} has insufficient stock`
            : payload?.message ||
                'One of the scanned items is out of stock'
        )
      } else if (
        error?.status === 401
      ) {
        showMessage(
          'error',
          'Session expired. Please login again.'
        )
      } else {
        showMessage(
          'error',
          error?.message ||
            'Sale could not be completed'
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const paymentLabel = method => {
    if (method === 'POS_UPI') {
      return 'UPI'
    }

    if (method === 'POS_CARD') {
      return 'Card'
    }

    if (method === 'POS_OTHER') {
      return 'Other'
    }

    return 'Cash'
  }

  return (
    <div className="pos-page">
      <Navbar />

      <main className="pos-shell">
        <section className="pos-header">
          <div className="pos-header-content">
            <span className="pos-label">
              Store Billing
            </span>

            <h1>
              Point of Sale
            </h1>

            <p>
              Scan one barcode and
              work only with that
              exact product variant.
            </p>
          </div>

          <div className="pos-header-stats">
            <div className="pos-stat">
              <span>
                Branch
              </span>

              <strong>
                {branchId}
              </strong>
            </div>

            <div className="pos-stat">
              <span>
                Items
              </span>

              <strong>
                {totals.quantity}
              </strong>
            </div>

            <div className="pos-stat">
              <span>
                Total
              </span>

              <strong>
                ₹
                {money(
                  totals.payable
                )}
              </strong>
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={`pos-message ${message.type}`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="pos-layout">
          <div className="pos-left">
            <div className="pos-card">
              <div className="pos-title-row">
                <div>
                  <span className="pos-label">
                    Barcode
                  </span>

                  <h2>
                    Scan Product
                  </h2>
                </div>

                <span
                  className={`pos-ready ${
                    scanning
                      ? 'loading'
                      : ''
                  }`}
                >
                  {scanning
                    ? 'Checking...'
                    : 'Ready'}
                </span>
              </div>

              <form
                className="pos-scan-form"
                onSubmit={
                  handleSubmit
                }
              >
                <div className="pos-input-wrap">
                  <span className="pos-barcode-icon">
                    ▥
                  </span>

                  <input
                    ref={inputRef}
                    value={ean}
                    onChange={event =>
                      setEan(
                        event.target.value.replace(
                          /\s+/g,
                          ''
                        )
                      )
                    }
                    placeholder="Scan or enter barcode"
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="submit"
                  className="pos-button pos-button-primary"
                  disabled={
                    scanning ||
                    !str(ean)
                  }
                >
                  {scanning
                    ? 'Checking'
                    : 'Add Product'}
                </button>
              </form>
            </div>

            {lastScanned ? (
              <div className="pos-card">
                <div className="pos-title-row">
                  <div>
                    <span className="pos-label">
                      Exact Barcode
                    </span>

                    <h2>
                      Scanned Product
                    </h2>
                  </div>

                  <span className="pos-exact-ean">
                    {
                      lastScanned.ean_code
                    }
                  </span>
                </div>

                <div className="pos-scanned-product">
                  <div className="pos-scanned-image">
                    {lastScanned.image_url ? (
                      <img
                        src={
                          lastScanned.image_url
                        }
                        alt={
                          lastScanned.name
                        }
                      />
                    ) : (
                      <div className="pos-no-image">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="pos-scanned-info">
                    <div className="pos-scanned-name">
                      {
                        lastScanned.name
                      }
                    </div>

                    <div className="pos-scanned-brand">
                      {lastScanned.brand ||
                        '-'}
                    </div>

                    <div className="pos-scanned-details">
                      <div>
                        <span>
                          Barcode
                        </span>

                        <strong>
                          {
                            lastScanned.ean_code
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Size
                        </span>

                        <strong>
                          {lastScanned.size ||
                            '-'}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Colour
                        </span>

                        <strong>
                          {lastScanned.colour ||
                            '-'}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Available
                        </span>

                        <strong>
                          {
                            lastScanned.available_qty
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          MRP
                        </span>

                        <strong>
                          ₹
                          {money(
                            lastScanned.mrp
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Sale Price
                        </span>

                        <strong>
                          ₹
                          {money(
                            lastScanned.price
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pos-card">
              <div className="pos-title-row">
                <div>
                  <span className="pos-label">
                    Current Sale
                  </span>

                  <h2>
                    Cart Items
                  </h2>
                </div>

                <span className="pos-cart-count">
                  {items.length}{' '}
                  {items.length === 1
                    ? 'barcode'
                    : 'barcodes'}
                </span>
              </div>

              <div className="pos-table-wrap">
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th>
                        Product
                      </th>

                      <th>
                        Barcode
                      </th>

                      <th>
                        Size
                      </th>

                      <th>
                        Colour
                      </th>

                      <th>
                        Available
                      </th>

                      <th>
                        Price
                      </th>

                      <th>
                        Qty
                      </th>

                      <th>
                        Total
                      </th>

                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {!items.length ? (
                      <tr>
                        <td
                          colSpan="9"
                          className="pos-empty"
                        >
                          <div className="pos-empty-icon">
                            ▥
                          </div>

                          <strong>
                            No products
                            scanned
                          </strong>

                          <span>
                            Scan a barcode
                            to add its exact
                            variant.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      items.map(
                        item => (
                          <tr
                            key={`${item.variant_id}-${item.ean_code}`}
                          >
                            <td>
                              <div className="pos-product">
                                <div className="pos-product-image">
                                  {item.image_url ? (
                                    <img
                                      src={
                                        item.image_url
                                      }
                                      alt={
                                        item.name
                                      }
                                    />
                                  ) : (
                                    <span>
                                      No
                                      Image
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <strong>
                                    {
                                      item.name
                                    }
                                  </strong>

                                  <span>
                                    {item.brand ||
                                      '-'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="pos-ean-cell">
                              {
                                item.ean_code
                              }
                            </td>

                            <td>
                              {item.size ||
                                '-'}
                            </td>

                            <td>
                              {item.colour ||
                                '-'}
                            </td>

                            <td>
                              <span
                                className={`pos-stock ${
                                  item.available_qty >
                                  0
                                    ? 'available'
                                    : 'unavailable'
                                }`}
                              >
                                {
                                  item.available_qty
                                }
                              </span>
                            </td>

                            <td>
                              <div className="pos-price">
                                <strong>
                                  ₹
                                  {money(
                                    item.price
                                  )}
                                </strong>

                                {item.mrp >
                                item.price ? (
                                  <span>
                                    ₹
                                    {money(
                                      item.mrp
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td>
                              <div className="pos-qty">
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeQty(
                                      item.variant_id,
                                      item.ean_code,
                                      -1
                                    )
                                  }
                                >
                                  −
                                </button>

                                <strong>
                                  {
                                    item.qty
                                  }
                                </strong>

                                <button
                                  type="button"
                                  disabled={
                                    item.qty >=
                                    item.available_qty
                                  }
                                  onClick={() =>
                                    changeQty(
                                      item.variant_id,
                                      item.ean_code,
                                      1
                                    )
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td className="pos-total-cell">
                              ₹
                              {money(
                                item.price *
                                  item.qty
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="pos-remove"
                                onClick={() =>
                                  removeItem(
                                    item.variant_id,
                                    item.ean_code
                                  )
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="pos-right">
            <div className="pos-card pos-summary">
              <span className="pos-label">
                Billing
              </span>

              <h2>
                Bill Summary
              </h2>

              <div className="pos-summary-list">
                <div>
                  <span>
                    Quantity
                  </span>

                  <strong>
                    {
                      totals.quantity
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    MRP Total
                  </span>

                  <strong>
                    ₹
                    {money(
                      totals.mrpTotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Discount
                  </span>

                  <strong className="pos-discount">
                    - ₹
                    {money(
                      totals.discount
                    )}
                  </strong>
                </div>

                <div className="pos-grand-total">
                  <span>
                    Grand Total
                  </span>

                  <strong>
                    ₹
                    {money(
                      totals.payable
                    )}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="pos-button pos-button-primary pos-full-button"
                disabled={
                  !items.length ||
                  scanning ||
                  submitting
                }
                onClick={
                  openCheckout
                }
              >
                Proceed to Payment
              </button>

              <button
                type="button"
                className="pos-button pos-button-secondary pos-full-button"
                disabled={
                  !items.length ||
                  submitting
                }
                onClick={
                  clearSale
                }
              >
                Clear Sale
              </button>
            </div>

            <div className="pos-card pos-info-card">
              <span className="pos-label">
                POS Rules
              </span>

              <h3>
                Exact Barcode Billing
              </h3>

              <div className="pos-info-list">
                <div>
                  <span>
                    1
                  </span>

                  <p>
                    One barcode loads
                    only its exact
                    variant.
                  </p>
                </div>

                <div>
                  <span>
                    2
                  </span>

                  <p>
                    Other colours and
                    sizes are not
                    automatically
                    displayed.
                  </p>
                </div>

                <div>
                  <span>
                    3
                  </span>

                  <p>
                    Re-scanning the
                    same barcode only
                    increases its
                    quantity.
                  </p>
                </div>

                <div>
                  <span>
                    4
                  </span>

                  <p>
                    Stock is verified
                    again before
                    payment.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {checkoutOpen ? (
        <div className="pos-modal-overlay">
          <div className="pos-modal">
            <div className="pos-modal-header">
              <div>
                <span className="pos-label">
                  Checkout
                </span>

                <h2>
                  Complete Payment
                </h2>
              </div>

              <button
                type="button"
                className="pos-close"
                disabled={
                  submitting
                }
                onClick={() =>
                  setCheckoutOpen(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="pos-payment-options">
              {[
                [
                  'POS_CASH',
                  'Cash'
                ],
                [
                  'POS_UPI',
                  'UPI'
                ],
                [
                  'POS_CARD',
                  'Card'
                ],
                [
                  'POS_OTHER',
                  'Other'
                ]
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={
                      submitting
                    }
                    className={
                      paymentMethod ===
                      value
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setPaymentMethod(
                        value
                      )
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="pos-customer-grid">
              <label>
                <span>
                  Reference / UTR
                </span>

                <input
                  value={
                    paymentRef
                  }
                  onChange={event =>
                    setPaymentRef(
                      event.target
                        .value
                    )
                  }
                  placeholder="Optional"
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                <span>
                  Customer Name
                </span>

                <input
                  value={
                    customerName
                  }
                  onChange={event =>
                    setCustomerName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Optional"
                  disabled={
                    submitting
                  }
                />
              </label>

              <label className="pos-customer-full">
                <span>
                  Customer Mobile
                </span>

                <input
                  value={
                    customerMobile
                  }
                  onChange={event =>
                    setCustomerMobile(
                      event.target.value.replace(
                        /[^0-9+]/g,
                        ''
                      )
                    )
                  }
                  placeholder="Optional"
                  disabled={
                    submitting
                  }
                />
              </label>
            </div>

            <div className="pos-payment-summary">
              <div>
                <span>
                  Quantity
                </span>

                <strong>
                  {
                    totals.quantity
                  }
                </strong>
              </div>

              <div>
                <span>
                  Payment
                </span>

                <strong>
                  {paymentLabel(
                    paymentMethod
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Payable
                </span>

                <strong>
                  ₹
                  {money(
                    totals.payable
                  )}
                </strong>
              </div>
            </div>

            <div className="pos-modal-actions">
              <button
                type="button"
                className="pos-button pos-button-secondary"
                disabled={
                  submitting
                }
                onClick={() =>
                  setCheckoutOpen(
                    false
                  )
                }
              >
                Back
              </button>

              <button
                type="button"
                className="pos-button pos-button-primary"
                disabled={
                  submitting ||
                  !items.length
                }
                onClick={
                  confirmSale
                }
              >
                {submitting
                  ? 'Completing Sale...'
                  : `Confirm ₹${money(
                      totals.payable
                    )}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="pos-modal-overlay">
          <div className="pos-modal pos-success-modal">
            <div className="pos-success-icon">
              ✓
            </div>

            <span className="pos-label">
              Completed
            </span>

            <h2>
              Sale Successful
            </h2>

            <p>
              Payment completed and
              stock updated.
            </p>

            <div className="pos-receipt">
              <div>
                <span>
                  Sale ID
                </span>

                <strong>
                  {receipt.sale_id
                    ? String(
                        receipt.sale_id
                      )
                        .slice(
                          0,
                          12
                        )
                        .toUpperCase()
                    : '-'}
                </strong>
              </div>

              <div>
                <span>
                  Quantity
                </span>

                <strong>
                  {
                    receipt.quantity
                  }
                </strong>
              </div>

              <div>
                <span>
                  Payment
                </span>

                <strong>
                  {paymentLabel(
                    receipt.payment_method
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total
                </span>

                <strong>
                  ₹
                  {money(
                    receipt.total
                  )}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="pos-button pos-button-primary pos-full-button"
              onClick={() => {
                setReceipt(null)

                setTimeout(() => {
                  inputRef.current?.focus()
                }, 50)
              }}
            >
              Start Next Sale
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}