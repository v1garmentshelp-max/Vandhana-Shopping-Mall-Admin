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

const pick = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizePatternType = value => cleanText(value).toUpperCase().slice(0, 100)

const normalizeAssetUrl = (value) => {
  const raw = cleanText(value)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const clean = raw.replace(/^\/+/, '')
  return `${ASSETS_BASE || API_BASE}/${clean}`
}

const normalizeBranchId = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const getStoredBranchId = () => {
  if (typeof window === 'undefined') return DEFAULT_BRANCH_ID
  return normalizeBranchId(localStorage.getItem('branch_id')) || normalizeBranchId(localStorage.getItem('branchId')) || DEFAULT_BRANCH_ID
}

const normalizeBarcode = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, '')

const coerceNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[₹, ]+/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

const clampDiscount = (value) => {
  const n = coerceNumber(value)
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

const computeFinal = (price, discount) => {
  const p = coerceNumber(price)
  const d = clampDiscount(discount)
  return Number((p - (p * d) / 100).toFixed(2))
}

const money = (value) =>
  coerceNumber(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const percent = (value) =>
  `${coerceNumber(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  })}%`

const toCategoryLabel = (value) => {
  const s = cleanText(value).toLowerCase()
  if (!s) return ''
  if (s === 'women' || s === "women's" || s === 'ladies' || s === 'female') return 'Women'
  if (s === 'men' || s === "men's" || s === 'mens' || s === 'male') return 'Men'
  if (s.startsWith('kid') || s === 'boys' || s === 'girls' || s === 'children') return 'Kids'
  return cleanText(value)
}

const toBackendGender = (value) => {
  const s = cleanText(value).toUpperCase()
  if (s === 'MEN') return 'MEN'
  if (s === 'WOMEN') return 'WOMEN'
  if (s === 'KIDS' || s === 'KID') return 'KIDS'
  return ''
}

const getImageValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return normalizeAssetUrl(value)
  return normalizeAssetUrl(value.image_url || value.imageUrl || value.secure_url || value.url || '')
}

const flattenCategories = (tree) => {
  const out = []

  const walk = (items, parents = []) => {
    for (const item of Array.isArray(items) ? items : []) {
      const path = [...parents, item.name].filter(Boolean)
      if (item.level > 0 && item.parent_id) {
        out.push({
          id: item.id,
          gender: item.gender,
          name: item.name,
          slug: item.slug,
          level: item.level,
          parent_id: item.parent_id,
          label: path.join(' > '),
          category_path: item.category_path || path.join(' > ')
        })
      }
      if (Array.isArray(item.children) && item.children.length) walk(item.children, path)
    }
  }

  walk(tree)
  return out
}

const getImagesFromApi = (item, variant) => {
  const front = getImageValue(
    pick(
      variant?.front_image_url,
      variant?.frontImageUrl,
      variant?.image_url,
      variant?.imageUrl,
      item?.front_image_url,
      item?.frontImageUrl,
      item?.image_url,
      item?.imageUrl,
      Array.isArray(variant?.images) ? variant.images.find((x) => String(x?.image_type || '').toLowerCase() === 'front') : '',
      Array.isArray(item?.images) ? item.images.find((x) => String(x?.image_type || '').toLowerCase() === 'front') : '',
      Array.isArray(variant?.images) ? variant.images[0] : '',
      Array.isArray(item?.images) ? item.images[0] : ''
    )
  )

  const back = getImageValue(
    pick(
      variant?.back_image_url,
      variant?.backImageUrl,
      item?.back_image_url,
      item?.backImageUrl,
      Array.isArray(variant?.images) ? variant.images.find((x) => String(x?.image_type || '').toLowerCase() === 'back') : '',
      Array.isArray(item?.images) ? item.images.find((x) => String(x?.image_type || '').toLowerCase() === 'back') : '',
      Array.isArray(variant?.images) ? variant.images[1] : '',
      Array.isArray(item?.images) ? item.images[1] : ''
    )
  )

  return { front, back }
}

const makeRowKey = (row) => {
  const barcode = normalizeBarcode(row.ean_code || row.barcode)
  const variantId = cleanText(row.variant_id || row.variantId)
  const productId = cleanText(row.product_id || row.productId)
  const size = cleanText(row.size)
  const color = cleanText(row.color || row.colour)
  return [barcode, variantId, productId, size, color].join('::')
}

const getOriginalB2C = (item, variant) =>
  coerceNumber(
    pick(
      variant?.original_price_b2c,
      variant?.originalPriceB2c,
      variant?.b2c_original_price,
      variant?.mrp,
      variant?.original_price,
      item?.original_price_b2c,
      item?.originalPriceB2c,
      item?.b2c_original_price,
      item?.mrp,
      item?.original_price,
      item?.originalPrice
    )
  )

const getOriginalB2B = (item, variant, fallback) =>
  coerceNumber(
    pick(
      variant?.original_price_b2b,
      variant?.originalPriceB2b,
      variant?.b2b_original_price,
      variant?.cost_price,
      variant?.costPrice,
      item?.original_price_b2b,
      item?.originalPriceB2b,
      item?.b2b_original_price,
      item?.cost_price,
      item?.costPrice,
      fallback
    )
  )

const getDiscountB2C = (item, variant) =>
  clampDiscount(
    pick(
      variant?.b2c_discount_pct,
      variant?.b2cDiscountPct,
      variant?.discount_b2c,
      variant?.discountB2c,
      variant?.b2c_discount,
      variant?.discount_percentage,
      variant?.discountPercent,
      variant?.discount_percent,
      variant?.discount,
      item?.b2c_discount_pct,
      item?.b2cDiscountPct,
      item?.discount_b2c,
      item?.discountB2c,
      item?.b2c_discount,
      item?.discount_percentage,
      item?.discountPercent,
      item?.discount_percent,
      item?.discount,
      0
    )
  )

const getDiscountB2B = (item, variant) =>
  clampDiscount(
    pick(
      variant?.b2b_discount_pct,
      variant?.b2bDiscountPct,
      variant?.discount_b2b,
      variant?.discountB2b,
      variant?.b2b_discount,
      variant?.discount_percentage_b2b,
      item?.b2b_discount_pct,
      item?.b2bDiscountPct,
      item?.discount_b2b,
      item?.discountB2b,
      item?.b2b_discount,
      item?.discount_percentage_b2b,
      0
    )
  )

const getFinalB2C = (item, variant, originalB2C, discountB2C) => {
  if (discountB2C > 0) return computeFinal(originalB2C, discountB2C)
  return coerceNumber(
    pick(
      variant?.final_price_b2c,
      variant?.finalPriceB2c,
      variant?.b2c_final_price,
      variant?.b2cFinalPrice,
      variant?.sale_price,
      variant?.salePrice,
      variant?.selling_price,
      variant?.sellingPrice,
      variant?.price,
      item?.final_price_b2c,
      item?.finalPriceB2c,
      item?.b2c_final_price,
      item?.b2cFinalPrice,
      item?.sale_price,
      item?.salePrice,
      item?.selling_price,
      item?.sellingPrice,
      item?.price,
      originalB2C
    )
  )
}

const getFinalB2B = (item, variant, originalB2B, discountB2B) => {
  if (discountB2B > 0) return computeFinal(originalB2B, discountB2B)
  return coerceNumber(
    pick(
      variant?.final_price_b2b,
      variant?.finalPriceB2b,
      variant?.b2b_final_price,
      variant?.b2bFinalPrice,
      item?.final_price_b2b,
      item?.finalPriceB2b,
      item?.b2b_final_price,
      item?.b2bFinalPrice,
      originalB2B
    )
  )
}

const rowFromApi = (item, variant, fallbackBranchId = DEFAULT_BRANCH_ID) => {
  const productId = pick(item?.product_id, item?.productId, variant?.product_id, variant?.productId)
  const variantId = pick(variant?.variant_id, variant?.variantId, variant?.id, item?.variant_id, item?.variantId, item?.primary_variant_id, item?.primaryVariantId, item?.id)
  const barcode = normalizeBarcode(pick(variant?.ean_code, variant?.eanCode, variant?.barcode, item?.ean_code, item?.eanCode, item?.barcode))
  const originalB2C = getOriginalB2C(item, variant)
  const originalB2B = getOriginalB2B(item, variant, originalB2C)
  const discountB2C = getDiscountB2C(item, variant)
  const discountB2B = getDiscountB2B(item, variant)
  const finalB2C = getFinalB2C(item, variant, originalB2C, discountB2C)
  const finalB2B = getFinalB2B(item, variant, originalB2B, discountB2B)
  const images = getImagesFromApi(item, variant)
  const stock = coerceNumber(
    pick(
      variant?.total_count,
      variant?.totalCount,
      variant?.on_hand,
      variant?.onHand,
      variant?.available_qty,
      variant?.availableQty,
      variant?.stock,
      variant?.quantity,
      item?.total_count,
      item?.totalCount,
      item?.on_hand,
      item?.onHand,
      item?.available_qty,
      item?.availableQty,
      item?.stock,
      item?.quantity,
      0
    )
  )

  const categoryId = pick(item?.category_id, item?.categoryId, variant?.category_id, variant?.categoryId)
  const categoryName = cleanText(pick(item?.category_name, item?.categoryName, variant?.category_name, variant?.categoryName))
  const categorySlug = cleanText(pick(item?.category_slug, item?.categorySlug, variant?.category_slug, variant?.categorySlug))
  const parentCategoryName = cleanText(pick(item?.parent_category_name, item?.parentCategoryName, variant?.parent_category_name, variant?.parentCategoryName))
  const categoryPath = cleanText(pick(item?.category_path, item?.categoryPath, variant?.category_path, variant?.categoryPath, [parentCategoryName, categoryName].filter(Boolean).join(' > ')))

  const row = {
    row_key: '',
    id: variantId || productId || barcode,
    product_id: productId,
    variant_id: variantId,
    barcode,
    ean_code: barcode,
    branch_id: normalizeBranchId(pick(item?.branch_id, item?.branchId, variant?.branch_id, variant?.branchId, fallbackBranchId)) || fallbackBranchId,
    category: toCategoryLabel(pick(item?.category, item?.gender, variant?.category, variant?.gender)),
    category_id: categoryId,
    category_name: categoryName,
    category_slug: categorySlug,
    parent_category_name: parentCategoryName,
    category_path: categoryPath,
    design_code: cleanText(pick(item?.design_code, item?.designCode, variant?.design_code, variant?.designCode)),
    pattern_type: normalizePatternType(pick(item?.pattern_type, item?.patternType, variant?.pattern_type, variant?.patternType)),
    saved_pattern_type: normalizePatternType(pick(item?.pattern_type, item?.patternType, variant?.pattern_type, variant?.patternType)),
    pattern_code: cleanText(pick(item?.pattern_code, item?.patternCode, variant?.pattern_code, variant?.patternCode)),
    brand: cleanText(pick(item?.brand, item?.brand_name, item?.brandName, variant?.brand, variant?.brand_name, variant?.brandName)),
    product_name: cleanText(pick(item?.product_name, item?.productName, item?.name, item?.title, variant?.product_name, variant?.productName, variant?.name, variant?.title)),
    color: cleanText(pick(variant?.color, variant?.colour, variant?.selected_color, variant?.selectedColor, item?.color, item?.colour, item?.selected_color, item?.selectedColor, item?.display_color, item?.displayColor)),
    size: cleanText(pick(variant?.size, variant?.selected_size, variant?.selectedSize, item?.size, item?.selected_size, item?.selectedSize, item?.display_size, item?.displaySize)),
    original_price_b2b: originalB2B,
    discount_b2b: discountB2B,
    final_price_b2b: finalB2B,
    original_price_b2c: originalB2C,
    discount_b2c: discountB2C,
    final_price_b2c: finalB2C,
    saved_original_price_b2b: originalB2B,
    saved_discount_b2b: discountB2B,
    saved_final_price_b2b: finalB2B,
    saved_original_price_b2c: originalB2C,
    saved_discount_b2c: discountB2C,
    saved_final_price_b2c: finalB2C,
    total_count: stock,
    image_url: images.front,
    back_image_url: images.back,
    newImageFile: null,
    newBackImageFile: null,
    preview_url: '',
    back_preview_url: '',
    dirty: false,
    saving: false,
    last_saved_at: pick(item?.updated_at, item?.modified_at, variant?.updated_at, variant?.modified_at)
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

const getVariantsForItem = (item) => {
  if (Array.isArray(item?.color_variants) && item.color_variants.length) return item.color_variants
  if (Array.isArray(item?.colorVariants) && item.colorVariants.length) return item.colorVariants
  if (Array.isArray(item?.variants) && item.variants.length) return item.variants
  return [item]
}

const flattenApiItems = (items, fallbackBranchId) => {
  const out = []
  const seen = new Set()

  for (const item of Array.isArray(items) ? items : []) {
    const variants = getVariantsForItem(item)

    for (const variant of variants) {
      const row = rowFromApi(item, variant, fallbackBranchId)
      const key = row.row_key
      if (!key.replace(/:/g, '').trim()) continue
      if (seen.has(key)) continue
      seen.add(key)
      out.push(row)
    }
  }

  return out
}

const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {}
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

const fetchAllProducts = async (branchId) => {
  const urls = [
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=MEN`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=WOMEN`,
    `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock?gender=KIDS`,
    `${API_BASE}/api/products?branch_id=${encodeURIComponent(branchId)}&all=true`,
    `${API_BASE}/api/products?all=true`
  ]

  const map = new Map()

  for (const url of urls) {
    try {
      const data = await fetchJson(url)
      const rows = flattenApiItems(getItemsFromResponse(data), branchId)
      for (const row of rows) {
        if (!map.has(row.row_key)) map.set(row.row_key, row)
      }
    } catch {}
  }

  return Array.from(map.values())
}

const fetchCategoryOptions = async () => {
  const tree = await fetchJson(`${API_BASE}/api/categories/tree`)
  return flattenCategories(tree)
}

const UpdateProduct = () => {
  const [branchId] = useState(() => getStoredBranchId())
  const [rows, setRows] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [popupConfirm, setPopupConfirm] = useState(false)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const showPopup = (message, type = 'success', timeout = 2600) => {
    setPopupMessage(message)
    setPopupType(type)
    setTimeout(() => setPopupMessage(''), timeout)
  }

  const fetchCategories = useCallback(async () => {
    try {
      const data = await fetchCategoryOptions()
      setCategoryOptions(data)
    } catch {
      setCategoryOptions([])
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      if (typeof window !== 'undefined') localStorage.setItem('branch_id', String(branchId))
      const mapped = await fetchAllProducts(branchId)
      setRows((prev) => {
        const active = new Map()
        prev.forEach((row) => {
          if (row.dirty || row.saving) active.set(row.row_key, row)
        })
        return mapped.map((row) => active.get(row.row_key) || row)
      })
    } catch (err) {
      setRows([])
      showPopup(err?.message || 'Unable to load products', 'error', 3000)
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchCategories()
    fetchAll()
  }, [fetchCategories, fetchAll])

  useEffect(() => {
    return () => {
      rows.forEach((row) => {
        if (row.preview_url) URL.revokeObjectURL(row.preview_url)
        if (row.back_preview_url) URL.revokeObjectURL(row.back_preview_url)
      })
    }
  }, [rows])

  const categoryOptionsByGender = useMemo(() => {
    const map = { Men: [], Women: [], Kids: [] }

    categoryOptions.forEach((c) => {
      if (c.gender === 'MEN') map.Men.push(c)
      if (c.gender === 'WOMEN') map.Women.push(c)
      if (c.gender === 'KIDS') map.Kids.push(c)
    })

    return map
  }, [categoryOptions])

  const rowIndexByKey = useMemo(() => {
    const map = new Map()
    rows.forEach((row, index) => map.set(row.row_key, index))
    return map
  }, [rows])

  const updateField = (index, field, value) => {
    if (index < 0 || index === undefined || index === null) return

    setRows((prev) => {
      const next = [...prev]
      const current = { ...next[index] }

      if (field === 'pattern_type') {
        const normalized = normalizePatternType(value)
        const productId = String(current.product_id || '')

        return next.map((row, rowIndex) => {
          if (String(row.product_id || '') !== productId) return row
          return {
            ...row,
            pattern_type: normalized,
            dirty: rowIndex === index ? true : row.dirty
          }
        })
      }

      if (field === 'category') {
        current.category = toCategoryLabel(value)
        current.category_id = ''
        current.category_name = ''
        current.category_slug = ''
        current.parent_category_name = ''
        current.category_path = ''
      } else if (field === 'category_id') {
        const opt = categoryOptions.find(c => String(c.id) === String(value))
        current.category_id = value
        current.category_name = opt?.name || ''
        current.category_slug = opt?.slug || ''
        current.category_path = opt?.category_path || opt?.label || ''
        current.parent_category_name = opt?.label ? opt.label.split(' > ').slice(-2, -1)[0] || '' : ''
      } else if (field === 'original_price_b2b' || field === 'discount_b2b' || field === 'original_price_b2c' || field === 'discount_b2c' || field === 'total_count') {
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
    const q = search.trim().toLowerCase()
    let list = rows

    if (filter === 'Men') list = list.filter((row) => String(row.category).toLowerCase() === 'men')
    if (filter === 'Women') list = list.filter((row) => String(row.category).toLowerCase() === 'women')
    if (filter === 'Kids') list = list.filter((row) => String(row.category).toLowerCase().startsWith('kids'))

    if (q) {
      list = list.filter((row) =>
        [row.id, row.product_id, row.variant_id, row.barcode, row.ean_code, row.design_code, row.pattern_type, row.pattern_code, row.brand, row.product_name, row.color, row.size, row.category, row.category_name, row.parent_category_name, row.category_path]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(q))
      )
    }

    const sorted = [...list]

    if (sortBy === 'recent') sorted.sort((a, b) => coerceNumber(b.variant_id || b.id) - coerceNumber(a.variant_id || a.id))
    if (sortBy === 'discount_b2c_desc') sorted.sort((a, b) => coerceNumber(b.discount_b2c) - coerceNumber(a.discount_b2c))
    if (sortBy === 'discount_b2c_asc') sorted.sort((a, b) => coerceNumber(a.discount_b2c) - coerceNumber(b.discount_b2c))
    if (sortBy === 'price_b2c_asc') sorted.sort((a, b) => coerceNumber(a.final_price_b2c) - coerceNumber(b.final_price_b2c))
    if (sortBy === 'price_b2c_desc') sorted.sort((a, b) => coerceNumber(b.final_price_b2c) - coerceNumber(a.final_price_b2c))
    if (sortBy === 'stock_desc') sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count))
    if (sortBy === 'brand_asc') sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')))

    return sorted
  }, [rows, filter, search, sortBy])

  const dirtyRows = useMemo(() => rows.filter((row) => row.dirty), [rows])

  const validationErrors = useMemo(() => {
    const errors = []

    dirtyRows.forEach((row) => {
      const missing = []
      if (!row.id && !row.product_id && !row.variant_id) missing.push('id')
      if (!cleanText(row.ean_code || row.barcode)) missing.push('ean code')
      if (!cleanText(row.category)) missing.push('gender')
      if (!cleanText(row.category_id)) missing.push('sub-category')
      if (!cleanText(row.design_code)) missing.push('design code')
      if (cleanText(row.pattern_type).length > 100) missing.push('valid pattern type')
      if (!cleanText(row.brand)) missing.push('brand')
      if (!cleanText(row.product_name)) missing.push('product name')
      if (!cleanText(row.color)) missing.push('color')
      if (!cleanText(row.size)) missing.push('size')
      if (!(row.image_url || row.preview_url || row.newImageFile)) missing.push('image')
      if (coerceNumber(row.discount_b2b) < 0 || coerceNumber(row.discount_b2b) > 100) missing.push('valid b2b discount')
      if (coerceNumber(row.discount_b2c) < 0 || coerceNumber(row.discount_b2c) > 100) missing.push('valid b2c discount')

      if (missing.length) {
        errors.push({
          name: `${row.product_name || `Row ${row.id}`} ${row.ean_code || row.barcode ? `(${row.ean_code || row.barcode})` : ''}`,
          fields: missing
        })
      }
    })

    return errors
  }, [dirtyRows])

  const uploadImageFile = async (file, role, row) => {
    if (!file) return ''

    const formData = new FormData()
    const barcode = normalizeBarcode(row.ean_code || row.barcode || row.variant_id || row.id || 'product')
    formData.append('image', file, `${barcode}__${role}__${Date.now()}_${file.name}`)

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.message || `Upload failed ${res.status}`)

    return normalizeAssetUrl(data?.imageUrl || data?.url || data?.path || data?.image_url)
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
    if (!res.ok) throw new Error(data?.message || `Request failed ${res.status}`)
    return data
  }

  const confirmUploadedImages = async (row, frontImage, backImage) => {
    const barcode = normalizeBarcode(row.ean_code || row.barcode)
    if (!barcode) return

    const images = []

    if (row.newImageFile && frontImage) {
      images.push({
        barcode,
        image_type: 'front',
        image_url: frontImage,
        secure_url: frontImage,
        public_id: '',
        original_filename: `${barcode}__front`
      })
    }

    if (row.newBackImageFile && backImage) {
      images.push({
        barcode,
        image_type: 'back',
        image_url: backImage,
        secure_url: backImage,
        public_id: '',
        original_filename: `${barcode}__back`
      })
    }

    if (images.length) {
      await postJson(`${API_BASE}/api/branch/${encodeURIComponent(row.branch_id || branchId)}/images/confirm`, { images })
    }
  }

  const uploadImagesIfNeeded = async (row) => {
    const frontImage = row.newImageFile ? await uploadImageFile(row.newImageFile, 'front', row) : row.image_url
    const backImage = row.newBackImageFile ? await uploadImageFile(row.newBackImageFile, 'back', row) : row.back_image_url
    await confirmUploadedImages(row, frontImage, backImage)
    return { frontImage, backImage }
  }

  const buildPayload = (row, image_url, back_image_url) => {
    const originalB2B = coerceNumber(row.original_price_b2b)
    const discountB2B = clampDiscount(row.discount_b2b)
    const finalB2B = computeFinal(originalB2B, discountB2B)
    const originalB2C = coerceNumber(row.original_price_b2c)
    const discountB2C = clampDiscount(row.discount_b2c)
    const finalB2C = computeFinal(originalB2C, discountB2C)
    const stock = Math.max(0, Math.floor(coerceNumber(row.total_count)))
    const barcode = normalizeBarcode(row.ean_code || row.barcode)
    const gender = toBackendGender(row.category)

    return {
      id: row.id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      barcode,
      ean_code: barcode,
      branch_id: row.branch_id || branchId,
      category: gender,
      gender,
      category_id: row.category_id,
      categoryId: row.category_id,
      design_code: row.design_code,
      designCode: row.design_code,
      pattern_type: normalizePatternType(row.pattern_type) || null,
      patternType: normalizePatternType(row.pattern_type) || null,
      pattern_code: row.pattern_code,
      patternCode: row.pattern_code,
      brand: row.brand,
      brand_name: row.brand,
      product_name: row.product_name,
      name: row.product_name,
      title: row.product_name,
      color: row.color,
      colour: row.color,
      size: row.size,
      original_price_b2b: originalB2B,
      originalPriceB2b: originalB2B,
      b2b_original_price: originalB2B,
      cost_price: originalB2B,
      discount_b2b: discountB2B,
      discountB2b: discountB2B,
      b2b_discount: discountB2B,
      b2b_discount_pct: discountB2B,
      b2bDiscountPct: discountB2B,
      discount_percentage_b2b: discountB2B,
      final_price_b2b: finalB2B,
      finalPriceB2b: finalB2B,
      b2b_final_price: finalB2B,
      b2bFinalPrice: finalB2B,
      original_price_b2c: originalB2C,
      originalPriceB2c: originalB2C,
      b2c_original_price: originalB2C,
      mrp: originalB2C,
      original_price: originalB2C,
      discount_b2c: discountB2C,
      discountB2c: discountB2C,
      b2c_discount: discountB2C,
      b2c_discount_pct: discountB2C,
      b2cDiscountPct: discountB2C,
      discount: discountB2C,
      discount_percentage: discountB2C,
      discountPercentage: discountB2C,
      discount_percent: discountB2C,
      discountPercent: discountB2C,
      final_price_b2c: finalB2C,
      finalPriceB2c: finalB2C,
      b2c_final_price: finalB2C,
      b2cFinalPrice: finalB2C,
      selling_price: finalB2C,
      sale_price: finalB2C,
      final_price: finalB2C,
      price_after_discount: finalB2C,
      price: finalB2C,
      total_count: stock,
      stock,
      quantity: stock,
      on_hand: stock,
      available_qty: stock,
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
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.message || `Update failed ${res.status}`)
    return data || payload
  }

  const buildSavedRow = (row, payload, frontImage, backImage) => {
    return {
      ...row,
      barcode: payload.barcode,
      ean_code: payload.ean_code,
      category: toCategoryLabel(payload.category),
      category_id: payload.category_id,
      design_code: payload.design_code,
      pattern_type: payload.pattern_type || '',
      saved_pattern_type: payload.pattern_type || '',
      pattern_code: payload.pattern_code,
      brand: payload.brand,
      product_name: payload.product_name,
      color: payload.color,
      size: payload.size,
      original_price_b2b: payload.original_price_b2b,
      discount_b2b: payload.discount_b2b,
      final_price_b2b: payload.final_price_b2b,
      original_price_b2c: payload.original_price_b2c,
      discount_b2c: payload.discount_b2c,
      final_price_b2c: payload.final_price_b2c,
      saved_original_price_b2b: payload.original_price_b2b,
      saved_discount_b2b: payload.discount_b2b,
      saved_final_price_b2b: payload.final_price_b2b,
      saved_original_price_b2c: payload.original_price_b2c,
      saved_discount_b2c: payload.discount_b2c,
      saved_final_price_b2c: payload.final_price_b2c,
      total_count: payload.total_count,
      image_url: frontImage,
      back_image_url: backImage,
      newImageFile: null,
      newBackImageFile: null,
      preview_url: '',
      back_preview_url: '',
      dirty: false,
      saving: false,
      last_saved_at: new Date().toISOString()
    }
  }

  const persistRow = async (row) => {
    const { frontImage, backImage } = await uploadImagesIfNeeded(row)
    const payload = buildPayload(row, frontImage, backImage)
    const branchQuery = `branch_id=${encodeURIComponent(row.branch_id || branchId)}`
    const barcode = normalizeBarcode(payload.ean_code || payload.barcode)

    const candidates = [
      row.variant_id ? { url: `${API_BASE}/api/products/variant/${encodeURIComponent(row.variant_id)}?${branchQuery}`, method: 'PUT' } : null,
      row.variant_id ? { url: `${API_BASE}/api/products/variant/${encodeURIComponent(row.variant_id)}?${branchQuery}`, method: 'PATCH' } : null,
      barcode ? { url: `${API_BASE}/api/products/barcode/${encodeURIComponent(barcode)}?${branchQuery}`, method: 'PUT' } : null,
      barcode ? { url: `${API_BASE}/api/products/barcode/${encodeURIComponent(barcode)}?${branchQuery}`, method: 'PATCH' } : null,
      row.id ? { url: `${API_BASE}/api/products/${encodeURIComponent(row.id)}?${branchQuery}&ean_code=${encodeURIComponent(barcode)}`, method: 'PUT' } : null,
      row.id ? { url: `${API_BASE}/api/products/${encodeURIComponent(row.id)}?${branchQuery}&ean_code=${encodeURIComponent(barcode)}`, method: 'PATCH' } : null,
      row.product_id && String(row.product_id) !== String(row.id) ? { url: `${API_BASE}/api/products/${encodeURIComponent(row.product_id)}?${branchQuery}&ean_code=${encodeURIComponent(barcode)}`, method: 'PUT' } : null,
      row.product_id && String(row.product_id) !== String(row.id) ? { url: `${API_BASE}/api/products/${encodeURIComponent(row.product_id)}?${branchQuery}&ean_code=${encodeURIComponent(barcode)}`, method: 'PATCH' } : null
    ].filter(Boolean)

    let lastError = null

    for (const candidate of candidates) {
      try {
        await updateProductRequest(candidate.url, candidate.method, payload)
        return buildSavedRow(row, payload, frontImage, backImage)
      } catch (err) {
        lastError = err
      }
    }

    throw lastError || new Error('Update failed')
  }

  const handleUpdateClick = () => {
    if (!dirtyRows.length) {
      showPopup('No changes to update', 'error', 2200)
      return
    }

    if (validationErrors.length) {
      const first = validationErrors[0]
      showPopup(`Missing in ${first.name}: ${first.fields.join(', ')}`, 'error', 3400)
      return
    }

    setPopupConfirm(true)
  }

  const confirmUpdate = async (confirmed) => {
    setPopupConfirm(false)
    if (!confirmed) return

    setIsSaving(true)

    try {
      const updatedMap = new Map()

      for (const row of rows) {
        if (!row.dirty) continue

        setRows((prev) => prev.map((item) => (item.row_key === row.row_key ? { ...item, saving: true } : item)))
        const updated = await persistRow(row)
        updatedMap.set(row.row_key, updated)
      }

      setRows((prev) => prev.map((row) => updatedMap.get(row.row_key) || row))
      showPopup('Changes saved successfully', 'success', 2600)
    } catch (err) {
      setRows((prev) => prev.map((row) => ({ ...row, saving: false })))
      showPopup(err?.message || 'Error saving changes', 'error', 3200)
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
            <p className="page-subtitle-vandana">Edit pattern type, website discounts, prices, stock, images and category details.</p>
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
          {['All', 'Men', 'Women', 'Kids'].map((item) => (
            <button key={item} className={`filter-pill-vandana ${filter === item ? 'active-vandana' : ''}`} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="toolbar-right-vandana">
          <input
            className="search-input-vandana"
            placeholder="Search by EAN, design, pattern, brand, product, color, size or category"
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
              <col className="col-id-vandana" />
              <col className="col-category-vandana" />
              <col className="col-id-vandana" />
              <col className="col-category-vandana" />
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
                <th>Design Code</th>
                <th>Pattern Type</th>
                <th>Legacy Pattern</th>
                <th>Gender</th>
                <th>Sub-category</th>
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
                  <td colSpan="20" className="empty-state-cell-vandana">Loading products...</td>
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
                  const availableSubcategories = categoryOptionsByGender[product.category] || []

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
                        <input type="text" value={product.design_code || ''} readOnly title="Design code can only be changed from Design Review" />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={product.pattern_type || ''}
                          onChange={(e) => updateField(rowIndex, 'pattern_type', e.target.value)}
                          maxLength={100}
                          placeholder="Pattern type"
                        />
                        <div className="current-mini-vandana">Current {product.saved_pattern_type || '-'}</div>
                      </td>

                      <td>
                        <input type="text" value={product.pattern_code || ''} readOnly title="Legacy pattern code" />
                      </td>

                      <td>
                        <select className="table-select-vandana" value={product.category} onChange={(e) => updateField(rowIndex, 'category', e.target.value)}>
                          <option value="">Select</option>
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Kids">Kids</option>
                        </select>
                      </td>

                      <td>
                        <select className="table-select-vandana" value={product.category_id || ''} onChange={(e) => updateField(rowIndex, 'category_id', e.target.value)}>
                          <option value="">Select</option>
                          {availableSubcategories.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input type="text" value={product.brand} onChange={(e) => updateField(rowIndex, 'brand', e.target.value)} />
                      </td>

                      <td>
                        <textarea value={product.product_name} onChange={(e) => updateField(rowIndex, 'product_name', e.target.value)} rows={2} />
                      </td>

                      <td>
                        <input type="text" value={product.color} onChange={(e) => updateField(rowIndex, 'color', e.target.value)} />
                      </td>

                      <td>
                        <input type="text" value={product.size} onChange={(e) => updateField(rowIndex, 'size', e.target.value)} />
                      </td>

                      <td>
                        <input type="number" value={product.original_price_b2b} onChange={(e) => updateField(rowIndex, 'original_price_b2b', e.target.value)} />
                        <div className="current-mini-vandana">Current ₹{money(product.saved_original_price_b2b)}</div>
                      </td>

                      <td>
                        <div className="discount-box-vandana">
                          <input type="number" min="0" max="100" value={product.discount_b2b} onChange={(e) => updateField(rowIndex, 'discount_b2b', e.target.value)} />
                          <div className={`discount-meta-vandana ${b2bChanged ? 'changed-vandana' : ''}`}>
                            <span>Current {percent(currentB2B)}</span>
                            <span>New {percent(newB2B)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={`readonly-value-vandana ${b2bChanged ? 'changed-vandana' : ''}`}>₹{money(finalB2B)}</div>
                        <div className="current-mini-vandana">Current ₹{money(product.saved_final_price_b2b)}</div>
                      </td>

                      <td>
                        <input type="number" value={product.original_price_b2c} onChange={(e) => updateField(rowIndex, 'original_price_b2c', e.target.value)} />
                        <div className="current-mini-vandana">Current ₹{money(product.saved_original_price_b2c)}</div>
                      </td>

                      <td>
                        <div className="discount-box-vandana">
                          <input type="number" min="0" max="100" value={product.discount_b2c} onChange={(e) => updateField(rowIndex, 'discount_b2c', e.target.value)} />
                          <div className={`discount-meta-vandana ${b2cChanged ? 'changed-vandana' : ''}`}>
                            <span>Current {percent(currentB2C)}</span>
                            <span>New {percent(newB2C)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={`readonly-value-vandana website-final-vandana ${b2cChanged ? 'changed-vandana' : ''}`}>₹{money(finalB2C)}</div>
                        <div className="current-mini-vandana">Current ₹{money(product.saved_final_price_b2c)}</div>
                      </td>

                      <td>
                        <input type="number" min="0" value={product.total_count} onChange={(e) => updateField(rowIndex, 'total_count', e.target.value)} />
                      </td>

                      <td>
                        <div className="image-stack-vandana">
                          <div className="image-stack-vandana">
                            <img src={product.preview_url || product.image_url || 'https://via.placeholder.com/76x76?text=No+Image'} alt="front product" className="table-image-vandana" />
                            <label className="upload-btn-vandana">
                              Front
                              <input type="file" accept="image/*" onChange={(e) => handleImageChange(rowIndex, e.target.files && e.target.files[0], 'front')} />
                            </label>
                          </div>
                          <div className="image-stack-vandana">
                            <img src={product.back_preview_url || product.back_image_url || 'https://via.placeholder.com/76x76?text=No+Back'} alt="back product" className="table-image-vandana" />
                            <label className="upload-btn-vandana">
                              Back
                              <input type="file" accept="image/*" onChange={(e) => handleImageChange(rowIndex, e.target.files && e.target.files[0], 'back')} />
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
                  <td colSpan="20" className="empty-state-cell-vandana">No products found</td>
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

      {popupMessage && <div className={`popup-toast-vandana ${popupType}`}>{popupMessage}</div>}

      {popupConfirm && (
        <div className="popup-overlay-vandana">
          <div className="confirm-modal-vandana">
            <h3>Save changes</h3>
            <p>Do you want to save all edited rows now?</p>
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