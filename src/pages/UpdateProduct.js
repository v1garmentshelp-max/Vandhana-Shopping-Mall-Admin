import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './UpdateProduct.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const DEFAULT_ASSETS_BASE = 'https://vandhana-shopping-mall-backend.vercel.app/uploads'
const DEFAULT_BRANCH_ID = 3

const PROCESS_ENV = typeof process !== 'undefined' && process.env ? process.env : {}

const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  PROCESS_ENV.REACT_APP_API_BASE ||
  PROCESS_ENV.REACT_APP_API_BASE_URL ||
  DEFAULT_API_BASE

const ASSETS_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ASSETS_BASE) ||
  PROCESS_ENV.REACT_APP_ASSETS_BASE ||
  DEFAULT_ASSETS_BASE

const API_BASE = API_BASE_RAW.replace(/\/+$/, '').replace(/\/api$/, '')
const ASSETS_BASE = ASSETS_BASE_RAW.replace(/\/+$/, '')

const normalizeAssetUrl = (maybeRelative) => {
  if (!maybeRelative) return ''
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  const base = ASSETS_BASE || API_BASE
  if (!base) return maybeRelative
  const clean = String(maybeRelative).replace(/^\/+/, '')
  return `${base}/${clean}`
}

const normalizeBranchId = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const getStoredBranchId = () => {
  if (typeof window === 'undefined') return DEFAULT_BRANCH_ID
  return (
    normalizeBranchId(localStorage.getItem('branch_id')) ||
    normalizeBranchId(localStorage.getItem('branchId')) ||
    DEFAULT_BRANCH_ID
  )
}

const getImageValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.image_url || value.secure_url || value.url || ''
}

const getImageFromList = (images, index) => {
  if (!Array.isArray(images)) return ''
  return getImageValue(images[index])
}

const coerceNumber = (v) => {
  if (v === '' || v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim())
  return Number.isFinite(n) ? n : 0
}

const clampDiscount = (v) => {
  const n = coerceNumber(v)
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

const money = (value) => {
  const n = coerceNumber(value)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const percent = (value) => {
  const n = coerceNumber(value)
  return `${n.toLocaleString('en-IN', {
    maximumFractionDigits: 2
  })}%`
}

const toCategoryLabel = (value) => {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return ''
  if (s === 'women' || s === "women's" || s === 'ladies' || s === 'female') return 'Women'
  if (s === 'men' || s === "men's" || s === 'mens' || s === 'male') return 'Men'
  if (s.startsWith('kid') || s === 'boys' || s === 'girls' || s === 'children') return 'Kids'
  return String(value || '').trim()
}

const computeFinal = (price, discount) => {
  const p = coerceNumber(price)
  const d = clampDiscount(discount)
  return Number((p - (p * d) / 100).toFixed(2))
}

const getFinalFromApi = (p, priceKey, discountKey, finalKeys) => {
  for (const key of finalKeys) {
    const value = p?.[key]
    if (value !== undefined && value !== null && value !== '') return coerceNumber(value)
  }
  return computeFinal(p?.[priceKey], p?.[discountKey])
}

const makeRowKey = (p) => {
  return [
    p.ean_code || p.barcode || '',
    p.variant_id || p.variantId || p.product_variant_id || '',
    p.product_id || p.productId || '',
    p.id || '',
    p.size || '',
    p.colour || p.color || ''
  ].join('::')
}

const rowFromApi = (p, fallbackBranchId = DEFAULT_BRANCH_ID) => {
  const productId = p.product_id || p.productId || p.product?.id || null
  const variantId = p.variant_id || p.product_variant_id || p.variantId || p.variant?.id || p.id || null
  const eanCode = p.ean_code || p.eanCode || p.barcode || ''
  const id = variantId || p.id || productId || eanCode

  const originalB2B = coerceNumber(
    p.original_price_b2b ??
      p.originalPriceB2b ??
      p.b2b_original_price ??
      p.wholesale_price ??
      p.cost_price ??
      p.costPrice ??
      p.original_price ??
      p.mrp ??
      p.price_b2b ??
      0
  )

  const discountB2B = clampDiscount(
    p.discount_b2b ??
      p.discountB2b ??
      p.b2b_discount ??
      p.b2b_discount_pct ??
      p.b2bDiscountPct ??
      p.discount_percentage_b2b ??
      p.wholesale_discount ??
      0
  )

  const originalB2C = coerceNumber(
    p.original_price_b2c ??
      p.originalPriceB2c ??
      p.b2c_original_price ??
      p.original_price ??
      p.mrp ??
      p.price ??
      p.price_b2c ??
      p.selling_price ??
      0
  )

  const discountB2C = clampDiscount(
    p.discount_b2c ??
      p.discountB2c ??
      p.b2c_discount ??
      p.b2c_discount_pct ??
      p.b2cDiscountPct ??
      p.discount_percentage ??
      p.discount_percent ??
      p.discount ??
      0
  )

  const finalB2B = getFinalFromApi(p, 'original_price_b2b', 'discount_b2b', [
    'final_price_b2b',
    'finalPriceB2b',
    'b2b_final_price',
    'b2bFinalPrice',
    'wholesale_final_price'
  ])

  const finalB2C = getFinalFromApi(p, 'original_price_b2c', 'discount_b2c', [
    'final_price_b2c',
    'finalPriceB2c',
    'b2c_final_price',
    'b2cFinalPrice',
    'selling_price',
    'sellingPrice',
    'sale_price',
    'salePrice',
    'final_price',
    'finalPrice',
    'price_after_discount'
  ])

  const imageUrl = normalizeAssetUrl(
    p.front_image_url ||
      p.frontImageUrl ||
      p.image_url ||
      p.image ||
      p.imageUrl ||
      p.path ||
      p.thumbnail ||
      getImageFromList(p.images, 0) ||
      ''
  )

  const backImageUrl = normalizeAssetUrl(
    p.back_image_url ||
      p.backImageUrl ||
      getImageFromList(p.images, 1) ||
      ''
  )

  const row = {
    row_key: '',
    id,
    product_id: productId,
    variant_id: variantId,
    barcode: eanCode,
    ean_code: eanCode,
    branch_id: p.branch_id || p.branchId || fallbackBranchId || DEFAULT_BRANCH_ID,
    category: toCategoryLabel(p.category || p.gender || p.department || ''),
    brand: p.brand || p.brand_name || p.brandName || '',
    product_name: p.product_name || p.name || p.productName || p.title || '',
    color: p.color || p.colour || p.selected_color || p.selectedColor || '',
    size: p.size || p.selected_size || p.selectedSize || '',
    original_price_b2b: originalB2B,
    discount_b2b: discountB2B,
    final_price_b2b: finalB2B || computeFinal(originalB2B, discountB2B),
    original_price_b2c: originalB2C,
    discount_b2c: discountB2C,
    final_price_b2c: finalB2C || computeFinal(originalB2C, discountB2C),
    saved_original_price_b2b: originalB2B,
    saved_discount_b2b: discountB2B,
    saved_final_price_b2b: finalB2B || computeFinal(originalB2B, discountB2B),
    saved_original_price_b2c: originalB2C,
    saved_discount_b2c: discountB2C,
    saved_final_price_b2c: finalB2C || computeFinal(originalB2C, discountB2C),
    total_count: coerceNumber(p.total_count ?? p.totalCount ?? p.available_qty ?? p.availableQty ?? p.on_hand ?? p.onHand ?? p.stock ?? p.quantity ?? 0),
    image_url: imageUrl,
    back_image_url: backImageUrl,
    newImageFile: null,
    newBackImageFile: null,
    preview_url: '',
    back_preview_url: '',
    dirty: false,
    saving: false,
    last_saved_at: p.updated_at || p.modified_at || null
  }

  row.row_key = makeRowKey(row)
  return row
}

const getItemsFromResponse = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.result)) return data.result
  return []
}

const flattenApiItems = (items, fallbackBranchId) => {
  const out = []
  const seen = new Set()

  for (const item of Array.isArray(items) ? items : []) {
    const variants = Array.isArray(item?.variants) && item.variants.length ? item.variants : [item]

    for (const variant of variants) {
      const merged = {
        ...item,
        ...variant,
        id: variant.variant_id || variant.variantId || variant.id || item.variant_id || item.variantId || item.id,
        product_id: item.product_id || item.productId || variant.product_id || variant.productId,
        productId: item.productId || item.product_id || variant.productId || variant.product_id,
        variant_id: variant.variant_id || variant.variantId || variant.id || item.variant_id || item.variantId,
        variantId: variant.variantId || variant.variant_id || variant.id || item.variantId || item.variant_id,
        product_name: item.product_name || item.productName || item.name || item.title || variant.product_name || variant.name,
        productName: item.productName || item.product_name || item.name || item.title || variant.productName,
        name: item.name || item.product_name || item.productName || item.title || variant.name,
        title: item.title || item.product_name || item.productName || item.name || variant.title,
        brand_name: item.brand_name || item.brandName || item.brand || variant.brand_name,
        brandName: item.brandName || item.brand_name || item.brand || variant.brandName,
        brand: item.brand || item.brand_name || item.brandName || variant.brand,
        gender: item.gender || item.category || variant.gender,
        category: item.category || item.gender || variant.category,
        branch_id: item.branch_id || item.branchId || variant.branch_id || variant.branchId || fallbackBranchId,
        image_url: variant.image_url || variant.imageUrl || item.image_url || item.imageUrl,
        imageUrl: variant.imageUrl || variant.image_url || item.imageUrl || item.image_url,
        front_image_url: variant.front_image_url || variant.frontImageUrl || item.front_image_url || item.frontImageUrl,
        frontImageUrl: variant.frontImageUrl || variant.front_image_url || item.frontImageUrl || item.front_image_url,
        back_image_url: variant.back_image_url || variant.backImageUrl || item.back_image_url || item.backImageUrl,
        backImageUrl: variant.backImageUrl || variant.back_image_url || item.backImageUrl || item.back_image_url,
        images: Array.isArray(variant.images) && variant.images.length ? variant.images : item.images
      }

      const row = rowFromApi(merged, fallbackBranchId)
      const key = row.row_key

      if (!seen.has(key)) {
        seen.add(key)
        out.push(row)
      }
    }
  }

  return out
}

const getHasMoreFromResponse = (data, itemsLength, limit, page) => {
  if (typeof data?.hasMore === 'boolean') return data.hasMore
  if (typeof data?.has_next === 'boolean') return data.has_next
  if (typeof data?.nextPage === 'number') return data.nextPage > page
  if (typeof data?.next_page === 'number') return data.next_page > page
  if (typeof data?.totalPages === 'number') return page < data.totalPages
  if (typeof data?.total_pages === 'number') return page < data.total_pages
  if (typeof data?.total === 'number') return page * limit < data.total
  if (typeof data?.count === 'number') return page * limit < data.count
  return itemsLength === limit
}

const getAuthHeaders = () => {
  const token =
    localStorage.getItem('auth_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    ''

  return token ? { Authorization: `Bearer ${token}` } : {}
}

const fetchJson = async (url, options = {}) => {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...getAuthHeaders()
    },
    cache: 'no-store'
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.message || `Request failed ${res.status}`)
  }

  return data
}

const postJson = async (url, payload) => {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.message || `Request failed ${res.status}`)
  }

  return data
}

const fetchAllProducts = async (branchId) => {
  const branchUrls = [
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=MEN`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=WOMEN`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=KIDS`
  ]

  const seenRows = new Map()

  for (const url of branchUrls) {
    try {
      const data = await fetchJson(url)
      const items = getItemsFromResponse(data)
      const rows = flattenApiItems(items, branchId)

      for (const row of rows) {
        if (!seenRows.has(row.row_key)) seenRows.set(row.row_key, row)
      }
    } catch {}
  }

  if (seenRows.size > 0) {
    return Array.from(seenRows.values())
  }

  const directUrls = [
    `${API_BASE}/api/products?branch_id=${encodeURIComponent(branchId)}&all=true`,
    `${API_BASE}/api/products?all=true`,
    `${API_BASE}/api/products?limit=50000`,
    `${API_BASE}/api/products`
  ]

  for (const url of directUrls) {
    try {
      const data = await fetchJson(url)
      const items = getItemsFromResponse(data)
      const rows = flattenApiItems(items, branchId)
      if (Array.isArray(rows) && rows.length > 0) return rows
    } catch {}
  }

  const pageSize = 1000
  let page = 1
  let hasMore = true
  const all = []
  const seen = new Set()

  while (hasMore) {
    const pageUrls = [
      `${API_BASE}/api/products?branch_id=${encodeURIComponent(branchId)}&page=${page}&limit=${pageSize}`,
      `${API_BASE}/api/products?page=${page}&limit=${pageSize}`,
      `${API_BASE}/api/products?page=${page}&pageSize=${pageSize}`,
      `${API_BASE}/api/products?page=${page}&per_page=${pageSize}`,
      `${API_BASE}/api/products?offset=${(page - 1) * pageSize}&limit=${pageSize}`
    ]

    let pageItems = []
    let responseData = null

    for (const url of pageUrls) {
      try {
        const data = await fetchJson(url)
        const items = getItemsFromResponse(data)
        if (Array.isArray(items) && items.length > 0) {
          pageItems = items
          responseData = data
          break
        }
      } catch {}
    }

    if (!pageItems.length) break

    const rows = flattenApiItems(pageItems, branchId)
    let addedThisRound = 0

    for (const item of rows) {
      const key = item.row_key
      if (!seen.has(key)) {
        seen.add(key)
        all.push(item)
        addedThisRound += 1
      }
    }

    if (addedThisRound === 0) break

    hasMore = getHasMoreFromResponse(responseData, pageItems.length, pageSize, page)
    page += 1

    if (page > 100) break
  }

  return all
}

const UpdateProduct = () => {
  const [branchId] = useState(() => getStoredBranchId())
  const [rows, setRows] = useState([])
  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [popupConfirm, setPopupConfirm] = useState(false)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      if (typeof window !== 'undefined') localStorage.setItem('branch_id', String(branchId))
      const mapped = await fetchAllProducts(branchId)
      setRows(mapped)
    } catch {
      setRows([])
      setPopupMessage('Unable to load products')
      setPopupType('error')
      setTimeout(() => setPopupMessage(''), 2400)
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    return () => {
      rows.forEach((r) => {
        if (r.preview_url) URL.revokeObjectURL(r.preview_url)
        if (r.back_preview_url) URL.revokeObjectURL(r.back_preview_url)
      })
    }
  }, [rows])

  const rowIndexByKey = useMemo(() => {
    const map = new Map()
    rows.forEach((r, i) => map.set(r.row_key, i))
    return map
  }, [rows])

  const updateField = (index, field, value) => {
    if (index < 0 || index === undefined || index === null) return

    setRows((prev) => {
      const next = [...prev]
      const current = { ...next[index] }

      if (field === 'category') {
        current[field] = toCategoryLabel(value)
      } else if (
        field === 'original_price_b2b' ||
        field === 'discount_b2b' ||
        field === 'original_price_b2c' ||
        field === 'discount_b2c' ||
        field === 'total_count'
      ) {
        current[field] = value === '' ? '' : field.includes('discount') ? clampDiscount(value) : coerceNumber(value)
      } else {
        current[field] = value
      }

      if (field === 'original_price_b2b' || field === 'discount_b2b') {
        current.final_price_b2b = computeFinal(current.original_price_b2b, current.discount_b2b)
      }

      if (field === 'original_price_b2c' || field === 'discount_b2c') {
        current.final_price_b2c = computeFinal(current.original_price_b2c, current.discount_b2c)
      }

      current.dirty = true
      next[index] = current
      return next
    })
  }

  const handleImageChange = (index, file, type = 'front') => {
    if (!file || index < 0 || index === undefined || index === null) return

    setRows((prev) => {
      const next = [...prev]
      const current = { ...next[index] }

      if (type === 'back') {
        if (current.back_preview_url) URL.revokeObjectURL(current.back_preview_url)
        current.newBackImageFile = file
        current.back_preview_url = URL.createObjectURL(file)
      } else {
        if (current.preview_url) URL.revokeObjectURL(current.preview_url)
        current.newImageFile = file
        current.preview_url = URL.createObjectURL(file)
      }

      current.dirty = true
      next[index] = current
      return next
    })
  }

  const filteredSortedRows = useMemo(() => {
    let list = rows

    if (filter === 'Men') list = list.filter((r) => String(r.category).toLowerCase() === 'men')
    else if (filter === 'Women') list = list.filter((r) => String(r.category).toLowerCase() === 'women')
    else if (filter === 'Kids') list = list.filter((r) => String(r.category).toLowerCase().startsWith('kids'))

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) =>
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.product_id || '').toLowerCase().includes(q) ||
        String(r.variant_id || '').toLowerCase().includes(q) ||
        String(r.barcode || '').toLowerCase().includes(q) ||
        String(r.ean_code || '').toLowerCase().includes(q) ||
        String(r.brand || '').toLowerCase().includes(q) ||
        String(r.product_name || '').toLowerCase().includes(q) ||
        String(r.color || '').toLowerCase().includes(q) ||
        String(r.size || '').toLowerCase().includes(q) ||
        String(r.category || '').toLowerCase().includes(q)
      )
    }

    const sorted = [...list]

    if (sortBy === 'recent') sorted.sort((a, b) => coerceNumber(b.variant_id || b.id) - coerceNumber(a.variant_id || a.id))
    else if (sortBy === 'discount_b2c_desc') sorted.sort((a, b) => coerceNumber(b.discount_b2c) - coerceNumber(a.discount_b2c))
    else if (sortBy === 'discount_b2c_asc') sorted.sort((a, b) => coerceNumber(a.discount_b2c) - coerceNumber(b.discount_b2c))
    else if (sortBy === 'price_b2c_asc') sorted.sort((a, b) => computeFinal(a.original_price_b2c, a.discount_b2c) - computeFinal(b.original_price_b2c, b.discount_b2c))
    else if (sortBy === 'price_b2c_desc') sorted.sort((a, b) => computeFinal(b.original_price_b2c, b.discount_b2c) - computeFinal(a.original_price_b2c, a.discount_b2c))
    else if (sortBy === 'stock_desc') sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count))
    else if (sortBy === 'brand_asc') sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')))

    return sorted
  }, [rows, filter, search, sortBy])

  const dirtyRows = useMemo(() => rows.filter((r) => r.dirty), [rows])

  const validationErrors = useMemo(() => {
    const errors = []

    dirtyRows.forEach((p) => {
      const missing = []

      if (!p.id && !p.product_id && !p.variant_id) missing.push('id')
      if (!String(p.ean_code || p.barcode || '').trim()) missing.push('ean code')
      if (!String(p.category || '').trim()) missing.push('category')
      if (!String(p.brand || '').trim()) missing.push('brand')
      if (!String(p.product_name || '').trim()) missing.push('product name')
      if (!String(p.color || '').trim()) missing.push('color')
      if (!String(p.size || '').trim()) missing.push('size')
      if (p.original_price_b2b === '' || p.original_price_b2b === null || p.original_price_b2b === undefined) missing.push('original price b2b')
      if (p.discount_b2b === '' || p.discount_b2b === null || p.discount_b2b === undefined) missing.push('discount b2b')
      if (p.original_price_b2c === '' || p.original_price_b2c === null || p.original_price_b2c === undefined) missing.push('original price b2c')
      if (p.discount_b2c === '' || p.discount_b2c === null || p.discount_b2c === undefined) missing.push('discount b2c')
      if (p.total_count === '' || p.total_count === null || p.total_count === undefined) missing.push('stock')
      if (!(p.image_url || p.preview_url || p.newImageFile)) missing.push('image')

      if (coerceNumber(p.discount_b2b) < 0 || coerceNumber(p.discount_b2b) > 100) missing.push('valid b2b discount')
      if (coerceNumber(p.discount_b2c) < 0 || coerceNumber(p.discount_b2c) > 100) missing.push('valid b2c discount')

      if (missing.length) {
        errors.push({
          id: p.id,
          name: `${p.product_name || `Row ${p.id}`} ${p.ean_code || p.barcode ? `(${p.ean_code || p.barcode})` : ''}`,
          fields: missing
        })
      }
    })

    return errors
  }, [dirtyRows])

  const validateDirty = () => dirtyRows.length > 0 && validationErrors.length === 0

  const showPopup = (message, type = 'success', timeout = 2400) => {
    setPopupMessage(message)
    setPopupType(type)
    setTimeout(() => setPopupMessage(''), timeout)
  }

  const handleUpdateClick = () => {
    if (!dirtyRows.length) {
      showPopup('No changes to update', 'error', 2200)
      return
    }

    if (!validateDirty()) {
      const first = validationErrors[0]
      const details = first ? `Missing in ${first.name}: ${first.fields.join(', ')}` : 'Please complete all required fields in edited rows'
      showPopup(details, 'error', 3400)
      return
    }

    setPopupConfirm(true)
  }

  const uploadImageFile = async (file, role, r) => {
    if (!file) return ''

    const formData = new FormData()
    const barcode = String(r.ean_code || r.barcode || r.variant_id || r.id || 'product').replace(/[^a-zA-Z0-9._-]/g, '')
    formData.append('image', file, `${barcode}__${role}__${Date.now()}_${file.name}`)

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) throw new Error(data?.message || `Upload failed ${res.status}`)

    return normalizeAssetUrl(data?.imageUrl || data?.url || data?.path || data?.image_url)
  }

  const confirmUploadedImages = async (r, frontImage, backImage) => {
    const barcode = String(r.ean_code || r.barcode || '').trim()
    if (!barcode) return

    const images = []

    if (r.newImageFile && frontImage) {
      images.push({
        barcode,
        image_type: 'front',
        image_url: frontImage,
        secure_url: frontImage,
        public_id: '',
        original_filename: `${barcode}__front`
      })
    }

    if (r.newBackImageFile && backImage) {
      images.push({
        barcode,
        image_type: 'back',
        image_url: backImage,
        secure_url: backImage,
        public_id: '',
        original_filename: `${barcode}__back`
      })
    }

    if (!images.length) return

    await postJson(`${API_BASE}/api/branch/${encodeURIComponent(r.branch_id || branchId)}/images/confirm`, {
      images
    })
  }

  const uploadImagesIfNeeded = async (r) => {
    const frontImage = r.newImageFile ? await uploadImageFile(r.newImageFile, 'front', r) : r.image_url
    const backImage = r.newBackImageFile ? await uploadImageFile(r.newBackImageFile, 'back', r) : r.back_image_url
    await confirmUploadedImages(r, frontImage, backImage)
    return { frontImage, backImage }
  }

  const buildPayload = (r, image_url, back_image_url) => {
    const originalB2B = coerceNumber(r.original_price_b2b)
    const discountB2B = clampDiscount(r.discount_b2b)
    const finalB2B = computeFinal(originalB2B, discountB2B)
    const originalB2C = coerceNumber(r.original_price_b2c)
    const discountB2C = clampDiscount(r.discount_b2c)
    const finalB2C = computeFinal(originalB2C, discountB2C)
    const stock = Math.max(0, Math.floor(coerceNumber(r.total_count)))

    return {
      id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      barcode: r.barcode || r.ean_code || '',
      ean_code: r.ean_code || r.barcode || '',
      branch_id: r.branch_id || branchId,
      category: r.category,
      gender: r.category,
      brand: r.brand,
      brand_name: r.brand,
      product_name: r.product_name,
      name: r.product_name,
      title: r.product_name,
      color: r.color,
      colour: r.color,
      size: r.size,
      original_price_b2b: originalB2B,
      b2b_original_price: originalB2B,
      discount_b2b: discountB2B,
      b2b_discount: discountB2B,
      discount_percentage_b2b: discountB2B,
      final_price_b2b: finalB2B,
      b2b_final_price: finalB2B,
      original_price_b2c: originalB2C,
      b2c_original_price: originalB2C,
      mrp: originalB2C,
      original_price: originalB2C,
      discount_b2c: discountB2C,
      b2c_discount: discountB2C,
      discount: discountB2C,
      discount_percentage: discountB2C,
      discount_percent: discountB2C,
      final_price_b2c: finalB2C,
      b2c_final_price: finalB2C,
      selling_price: finalB2C,
      sale_price: finalB2C,
      final_price: finalB2C,
      price_after_discount: finalB2C,
      price: finalB2C,
      total_count: stock,
      stock,
      quantity: stock,
      image_url,
      image: image_url,
      imageUrl: image_url,
      front_image_url: image_url,
      frontImageUrl: image_url,
      back_image_url,
      backImageUrl: back_image_url,
      images: [image_url, back_image_url].filter(Boolean)
    }
  }

  const updateProductRequest = async (url, method, payload) => {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.message || `Update failed ${res.status}`)
    }

    return data || payload
  }

  const persistRow = async (r) => {
    const { frontImage, backImage } = await uploadImagesIfNeeded(r)
    const payload = buildPayload(r, frontImage, backImage)
    const activeBranchId = r.branch_id || branchId
    const branchSuffix = activeBranchId ? `?branch_id=${encodeURIComponent(activeBranchId)}` : ''
    const eanSuffix = payload.ean_code ? `?ean_code=${encodeURIComponent(payload.ean_code)}${activeBranchId ? `&branch_id=${encodeURIComponent(activeBranchId)}` : ''}` : branchSuffix

    const candidates = [
      r.variant_id
        ? { url: `${API_BASE}/api/products/variant/${encodeURIComponent(r.variant_id)}${branchSuffix}`, method: 'PUT' }
        : null,
      r.variant_id
        ? { url: `${API_BASE}/api/products/variant/${encodeURIComponent(r.variant_id)}${branchSuffix}`, method: 'PATCH' }
        : null,
      payload.ean_code
        ? { url: `${API_BASE}/api/products/barcode/${encodeURIComponent(payload.ean_code)}${branchSuffix}`, method: 'PUT' }
        : null,
      payload.ean_code
        ? { url: `${API_BASE}/api/products/barcode/${encodeURIComponent(payload.ean_code)}${branchSuffix}`, method: 'PATCH' }
        : null,
      r.id
        ? { url: `${API_BASE}/api/products/${encodeURIComponent(r.id)}${eanSuffix}`, method: 'PUT' }
        : null,
      r.id
        ? { url: `${API_BASE}/api/products/${encodeURIComponent(r.id)}${eanSuffix}`, method: 'PATCH' }
        : null,
      r.product_id && String(r.product_id) !== String(r.id)
        ? { url: `${API_BASE}/api/products/${encodeURIComponent(r.product_id)}${eanSuffix}`, method: 'PUT' }
        : null,
      r.product_id && String(r.product_id) !== String(r.id)
        ? { url: `${API_BASE}/api/products/${encodeURIComponent(r.product_id)}${eanSuffix}`, method: 'PATCH' }
        : null
    ].filter(Boolean)

    let lastError = null

    for (const candidate of candidates) {
      try {
        const updated = await updateProductRequest(candidate.url, candidate.method, payload)
        const merged = rowFromApi({
          ...r,
          ...payload,
          ...updated,
          image_url: frontImage,
          back_image_url: backImage
        }, activeBranchId)

        return {
          ...merged,
          saved_original_price_b2b: coerceNumber(payload.original_price_b2b),
          saved_discount_b2b: clampDiscount(payload.discount_b2b),
          saved_final_price_b2b: computeFinal(payload.original_price_b2b, payload.discount_b2b),
          saved_original_price_b2c: coerceNumber(payload.original_price_b2c),
          saved_discount_b2c: clampDiscount(payload.discount_b2c),
          saved_final_price_b2c: computeFinal(payload.original_price_b2c, payload.discount_b2c),
          newImageFile: null,
          newBackImageFile: null,
          preview_url: '',
          back_preview_url: '',
          dirty: false,
          saving: false,
          last_saved_at: new Date().toISOString()
        }
      } catch (err) {
        lastError = err
      }
    }

    throw lastError || new Error('Update failed')
  }

  const confirmUpdate = async (confirmed) => {
    setPopupConfirm(false)
    if (!confirmed) return

    setIsSaving(true)

    try {
      const updatedMap = new Map()

      for (const r of rows) {
        if (!r.dirty) continue

        setRows((prev) =>
          prev.map((item) => (item.row_key === r.row_key ? { ...item, saving: true } : item))
        )

        const u = await persistRow(r)
        updatedMap.set(r.row_key, u)
      }

      setRows((prev) => prev.map((r) => updatedMap.get(r.row_key) || r))
      showPopup('Changes saved successfully. Website pricing is updated.', 'success', 2600)
      setTimeout(() => fetchAll(), 600)
    } catch (err) {
      setRows((prev) => prev.map((r) => ({ ...r, saving: false })))
      showPopup(err?.message || 'Error saving changes', 'error', 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const totalCount = rows.length
  const visibleCount = filteredSortedRows.length
  const editedCount = dirtyRows.length

  return (
    <div className="update-product-page-vandana">
      <div className="update-topbar-vandana">
        <div className="topbar-left-vandana">
          <div className="title-wrap-vandana">
            <p className="page-kicker-vandana">Product Control</p>
            <h1>Update Products</h1>
            <p className="page-subtitle-vandana">Edit website discounts, prices, stock, images and product details in one full screen workspace.</p>
          </div>

          <div className="summary-strip-vandana">
            <div className="summary-chip-vandana">
              <span>Total SKUs</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="summary-chip-vandana">
              <span>Visible</span>
              <strong>{visibleCount}</strong>
            </div>
            <div className="summary-chip-vandana active-vandana">
              <span>Edited</span>
              <strong>{editedCount}</strong>
            </div>
          </div>
        </div>

        <div className="topbar-right-vandana">
          <button className="ghost-btn-vandana" onClick={fetchAll} disabled={isLoading || isSaving}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="toolbar-card-vandana">
        <div className="filters-vandana">
          {['All', 'Men', 'Women', 'Kids'].map((f) => (
            <button key={f} className={`filter-pill-vandana ${filter === f ? 'active-vandana' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <div className="toolbar-right-vandana">
          <input
            className="search-input-vandana"
            placeholder="Search by EAN, variant id, brand, product, color, size or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select-vandana" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="discount_b2c_desc">Discount B2C: High to Low</option>
            <option value="discount_b2c_asc">Discount B2C: Low to High</option>
            <option value="price_b2c_asc">Price B2C: Low to High</option>
            <option value="price_b2c_desc">Price B2C: High to Low</option>
            <option value="stock_desc">Stock: High to Low</option>
            <option value="brand_asc">Brand: A to Z</option>
          </select>
        </div>
      </div>

      <div className="table-panel-vandana">
        <div className="table-panel-head-vandana">
          <div>
            <h2>Product Table</h2>
            <p>{editedCount ? `${editedCount} row${editedCount > 1 ? 's' : ''} have unsaved changes` : 'Everything is up to date'}</p>
          </div>
        </div>

        <div className="table-scroll-wrapper-vandana">
          <table className="table-vandana">
            <colgroup>
              <col className="col-sl-vandana" />
              <col className="col-id-vandana" />
              <col className="col-category-vandana" />
              <col className="col-brand-vandana" />
              <col className="col-name-vandana" />
              <col className="col-color-vandana" />
              <col className="col-size-vandana" />
              <col className="col-price-vandana" />
              <col className="col-discount-vandana" />
              <col className="col-final-vandana" />
              <col className="col-price-vandana" />
              <col className="col-discount-vandana" />
              <col className="col-final-vandana" />
              <col className="col-stock-vandana" />
              <col className="col-image-vandana" />
              <col className="col-status-vandana" />
            </colgroup>

            <thead>
              <tr>
                <th>Sl. No</th>
                <th>IDs</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Color</th>
                <th>Size</th>
                <th>Original B2B</th>
                <th>Discount B2B</th>
                <th>Final B2B</th>
                <th>Original B2C</th>
                <th>Website Discount B2C</th>
                <th>Website Final B2C</th>
                <th>Stock</th>
                <th>Front / Back Images</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="16" className="empty-state-cell-vandana">Loading products...</td>
                </tr>
              ) : filteredSortedRows.length ? (
                filteredSortedRows.map((product, idx) => {
                  const rowIndex = rowIndexByKey.get(product.row_key)
                  const currentB2B = coerceNumber(product.saved_discount_b2b)
                  const currentB2C = coerceNumber(product.saved_discount_b2c)
                  const newB2B = coerceNumber(product.discount_b2b)
                  const newB2C = coerceNumber(product.discount_b2c)
                  const finalB2B = computeFinal(product.original_price_b2b, product.discount_b2b)
                  const finalB2C = computeFinal(product.original_price_b2c, product.discount_b2c)
                  const b2bChanged = currentB2B !== newB2B || coerceNumber(product.saved_final_price_b2b) !== finalB2B
                  const b2cChanged = currentB2C !== newB2C || coerceNumber(product.saved_final_price_b2c) !== finalB2C

                  return (
                    <tr key={product.row_key || idx} className={product.dirty ? 'dirty-row-vandana' : ''}>
                      <td className="serial-cell-vandana">{idx + 1}</td>

                      <td>
                        <div className="id-stack-vandana">
                          <span title={String(product.product_id || product.id || '-')}>P: {product.product_id || product.id || '-'}</span>
                          <span title={String(product.variant_id || '-')}>V: {product.variant_id || '-'}</span>
                          <span title={String(product.ean_code || product.barcode || '-')}>EAN: {product.ean_code || product.barcode || '-'}</span>
                        </div>
                      </td>

                      <td>
                        <select
                          className="table-select-vandana"
                          value={product.category}
                          onChange={(e) => updateField(rowIndex, 'category', e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Kids">Kids</option>
                        </select>
                      </td>

                      <td>
                        <input
                          type="text"
                          value={product.brand}
                          onChange={(e) => updateField(rowIndex, 'brand', e.target.value)}
                        />
                      </td>

                      <td>
                        <textarea
                          value={product.product_name}
                          onChange={(e) => updateField(rowIndex, 'product_name', e.target.value)}
                          rows={2}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={product.color}
                          onChange={(e) => updateField(rowIndex, 'color', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={product.size}
                          onChange={(e) => updateField(rowIndex, 'size', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={product.original_price_b2b}
                          onChange={(e) => updateField(rowIndex, 'original_price_b2b', e.target.value)}
                        />
                        <div className="current-mini-vandana">Current ₹{money(product.saved_original_price_b2b)}</div>
                      </td>

                      <td>
                        <div className="discount-box-vandana">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={product.discount_b2b}
                            onChange={(e) => updateField(rowIndex, 'discount_b2b', e.target.value)}
                          />
                          <div className={`discount-meta-vandana ${b2bChanged ? 'changed-vandana' : ''}`}>
                            <span>Current {percent(currentB2B)}</span>
                            <span>New {percent(newB2B)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={`readonly-value-vandana ${b2bChanged ? 'changed-vandana' : ''}`}>
                          ₹{money(finalB2B)}
                        </div>
                        <div className="current-mini-vandana">Current ₹{money(product.saved_final_price_b2b)}</div>
                      </td>

                      <td>
                        <input
                          type="number"
                          value={product.original_price_b2c}
                          onChange={(e) => updateField(rowIndex, 'original_price_b2c', e.target.value)}
                        />
                        <div className="current-mini-vandana">Current ₹{money(product.saved_original_price_b2c)}</div>
                      </td>

                      <td>
                        <div className="discount-box-vandana">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={product.discount_b2c}
                            onChange={(e) => updateField(rowIndex, 'discount_b2c', e.target.value)}
                          />
                          <div className={`discount-meta-vandana ${b2cChanged ? 'changed-vandana' : ''}`}>
                            <span>Current {percent(currentB2C)}</span>
                            <span>New {percent(newB2C)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={`readonly-value-vandana website-final-vandana ${b2cChanged ? 'changed-vandana' : ''}`}>
                          ₹{money(finalB2C)}
                        </div>
                        <div className="current-mini-vandana">Current ₹{money(product.saved_final_price_b2c)}</div>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          value={product.total_count}
                          onChange={(e) => updateField(rowIndex, 'total_count', e.target.value)}
                        />
                      </td>

                      <td>
                        <div className="image-stack-vandana">
                          <div className="image-stack-vandana">
                            <img
                              src={product.preview_url || product.image_url || 'https://via.placeholder.com/76x76?text=No+Image'}
                              alt="front product"
                              className="table-image-vandana"
                            />
                            <label className="upload-btn-vandana">
                              Front
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(rowIndex, e.target.files && e.target.files[0], 'front')}
                              />
                            </label>
                          </div>
                          <div className="image-stack-vandana">
                            <img
                              src={product.back_preview_url || product.back_image_url || 'https://via.placeholder.com/76x76?text=No+Back'}
                              alt="back product"
                              className="table-image-vandana"
                            />
                            <label className="upload-btn-vandana">
                              Back
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(rowIndex, e.target.files && e.target.files[0], 'back')}
                              />
                            </label>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`status-badge-vandana ${product.saving ? 'saving-vandana' : product.dirty ? 'edited-vandana' : 'saved-vandana'}`}>
                          {product.saving ? 'Saving' : product.dirty ? 'Edited' : 'Saved'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="16" className="empty-state-cell-vandana">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="floating-savebar-vandana">
        <div className="floating-savebar-left-vandana">
          <span className="floating-label-vandana">Unsaved changes</span>
          <strong className="floating-value-vandana">{editedCount} row{editedCount !== 1 ? 's' : ''} edited</strong>
        </div>

        <div className="floating-savebar-right-vandana">
          <button className="ghost-btn-vandana" onClick={fetchAll} disabled={isLoading || isSaving}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="primary-btn-vandana" onClick={handleUpdateClick} disabled={!dirtyRows.length || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {popupMessage && (
        <div className={`popup-toast-vandana ${popupType}`}>
          {popupMessage}
        </div>
      )}

      {popupConfirm && (
        <div className="popup-overlay-vandana">
          <div className="confirm-modal-vandana">
            <h3>Save changes</h3>
            <p>Do you want to save all edited rows now? The B2C discount and final price will be sent to the website fields.</p>
            <div className="modal-actions-vandana">
              <button className="primary-btn-vandana" onClick={() => confirmUpdate(true)}>Yes, Save</button>
              <button className="ghost-btn-vandana" onClick={() => confirmUpdate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdateProduct