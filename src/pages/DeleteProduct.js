import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './DeleteProduct.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const DEFAULT_ASSETS_BASE = 'https://vandhana-shopping-mall-backend.vercel.app/uploads'
const API_BASE_RAW = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) || DEFAULT_API_BASE
const ASSETS_BASE_RAW = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ASSETS_BASE) || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_ASSETS_BASE) || DEFAULT_ASSETS_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')
const ASSETS_BASE = ASSETS_BASE_RAW.replace(/\/+$/, '')
const TABLE_PAGE_SIZE = 40
const CACHE_TTL = 60000
const SEARCH_DELAY = 250
let productRowsCache = { branchId: '', timestamp: 0, rows: [] }

const coerceNumber = (value) => {
  const number = typeof value === 'number' ? value : parseFloat(String(value ?? '').trim())
  return Number.isFinite(number) ? number : 0
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const normalizeKey = (value) => cleanText(value).toLowerCase()
const hasGroupedVariantValue = (value) => cleanText(value).includes(',')

const getBranchId = () => {
  if (typeof window === 'undefined') return ''
  const direct = localStorage.getItem('branch_id') || localStorage.getItem('branchId') || localStorage.getItem('selectedBranchId') || ''
  if (direct) return direct
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
    return String(user?.branch_id || user?.branchId || '')
  } catch {
    return ''
  }
}

const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token') || localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('accessToken') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const withBranch = (url) => {
  const branchId = getBranchId()
  if (!branchId) return url
  return `${url}${url.includes('?') ? '&' : '?'}branch_id=${encodeURIComponent(branchId)}`
}

const normalizeAssetUrl = (value) => {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = ASSETS_BASE || API_BASE
  return `${base}${String(value).startsWith('/') ? '' : '/'}${value}`
}

const computeFinal = (price, discount) => {
  const p = coerceNumber(price)
  const d = coerceNumber(discount)
  return Number((p - (p * d) / 100).toFixed(2))
}

const makeGroupKey = (row) => [cleanText(row.product_id), normalizeKey(row.category), normalizeKey(row.category_id), normalizeKey(row.brand), normalizeKey(row.product_name)].join('||')
const makeVariantKey = (row) => cleanText(row.variant_id || row.id) || [makeGroupKey(row), normalizeKey(row.color), normalizeKey(row.size), normalizeKey(row.barcode)].join('||')

const uniqueValues = (values) => {
  const map = new Map()

  for (const value of values || []) {
    const current = cleanText(value)
    if (!current) continue
    const key = normalizeKey(current)
    if (!map.has(key)) map.set(key, current)
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = parseFloat(String(a).replace(/[^\d.]/g, ''))
    const nb = parseFloat(String(b).replace(/[^\d.]/g, ''))

    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb

    return String(a).localeCompare(String(b), undefined, { numeric: true })
  })
}

const mapVariantRow = (product, variant) => {
  const productId = product.product_id ?? product.id ?? variant.product_id ?? ''
  const variantId = variant.variant_id ?? variant.id ?? ''
  const color = cleanText(variant.color || variant.colour)
  const size = cleanText(variant.size)

  if (!variantId || !color || !size) return null
  if (hasGroupedVariantValue(color) || hasGroupedVariantValue(size)) return null

  const originalPriceB2c = variant.original_price_b2c ?? variant.mrp ?? variant.price ?? variant.sale_price ?? product.original_price_b2c ?? product.mrp ?? product.price ?? 0
  const discountB2c = variant.discount_b2c ?? variant.b2c_discount_pct ?? product.discount_b2c ?? product.b2c_discount_pct ?? 0
  const originalPriceB2b = variant.original_price_b2b ?? variant.cost_price ?? variant.original_price_b2c ?? product.original_price_b2b ?? product.original_price_b2c ?? 0
  const discountB2b = variant.discount_b2b ?? variant.b2b_discount_pct ?? product.discount_b2b ?? product.b2b_discount_pct ?? 0

  const mapped = {
    id: variantId,
    variant_id: variantId,
    product_id: productId,
    category: cleanText(product.category || product.gender),
    category_id: product.category_id ?? variant.category_id ?? '',
    category_name: cleanText(product.category_name || variant.category_name),
    category_slug: cleanText(product.category_slug || variant.category_slug),
    parent_category_name: cleanText(product.parent_category_name || variant.parent_category_name),
    category_path: cleanText(product.category_path || variant.category_path),
    brand: cleanText(product.brand || product.brand_name),
    product_name: cleanText(product.product_name || product.name),
    design_code: cleanText(product.design_code || product.designCode || variant.design_code || variant.designCode),
    pattern_type: cleanText(product.pattern_type || product.patternType || variant.pattern_type || variant.patternType),
    pattern_code: cleanText(product.pattern_code || product.patternCode || variant.pattern_code || variant.patternCode),
    color,
    colour: color,
    size,
    barcode: cleanText(variant.barcode || variant.ean_code),
    original_price_b2b: coerceNumber(originalPriceB2b),
    discount_b2b: coerceNumber(discountB2b),
    final_price_b2b: coerceNumber(variant.final_price_b2b ?? product.final_price_b2b),
    original_price_b2c: coerceNumber(originalPriceB2c),
    discount_b2c: coerceNumber(discountB2c),
    final_price_b2c: coerceNumber(variant.final_price_b2c ?? product.final_price_b2c),
    total_count: coerceNumber(variant.on_hand ?? variant.total_count ?? variant.stock ?? variant.quantity ?? variant.available_qty ?? 0),
    reserved_count: coerceNumber(variant.reserved ?? variant.reserved_count ?? product.reserved ?? 0),
    available_qty: coerceNumber(variant.available_qty ?? variant.on_hand ?? variant.total_count ?? 0),
    image_url: normalizeAssetUrl(variant.shared_image_url || variant.image_url || product.shared_image_url || product.image_url || product.image || product.imageUrl || product.path || '')
  }

  return { ...mapped, group_key: makeGroupKey(mapped), variant_key: makeVariantKey(mapped) }
}

const mapSingleRow = (product) => {
  const productId = product.product_id ?? product.id ?? product._id ?? product.uuid ?? ''
  const variantId = product.variant_id ?? product.primary_variant_id ?? product.id ?? ''
  const color = cleanText(product.color || product.colour)
  const size = cleanText(product.size)

  if (!variantId || !color || !size) return null
  if (hasGroupedVariantValue(color) || hasGroupedVariantValue(size)) return null

  const mapped = {
    id: variantId,
    variant_id: variantId,
    product_id: productId,
    category: cleanText(product.category || product.gender),
    category_id: product.category_id || '',
    category_name: cleanText(product.category_name),
    category_slug: cleanText(product.category_slug),
    parent_category_name: cleanText(product.parent_category_name),
    category_path: cleanText(product.category_path),
    brand: cleanText(product.brand || product.brand_name),
    product_name: cleanText(product.product_name || product.name),
    design_code: cleanText(product.design_code || product.designCode),
    pattern_type: cleanText(product.pattern_type || product.patternType),
    pattern_code: cleanText(product.pattern_code || product.patternCode),
    color,
    colour: color,
    size,
    barcode: cleanText(product.barcode || product.ean_code),
    original_price_b2b: coerceNumber(product.original_price_b2b),
    discount_b2b: coerceNumber(product.discount_b2b || product.b2b_discount_pct),
    final_price_b2b: coerceNumber(product.final_price_b2b),
    original_price_b2c: coerceNumber(product.original_price_b2c || product.mrp),
    discount_b2c: coerceNumber(product.discount_b2c || product.b2c_discount_pct),
    final_price_b2c: coerceNumber(product.final_price_b2c),
    total_count: coerceNumber(product.on_hand ?? product.total_count ?? product.stock ?? product.quantity ?? product.available_qty ?? 0),
    reserved_count: coerceNumber(product.reserved ?? product.reserved_count ?? 0),
    available_qty: coerceNumber(product.available_qty ?? product.on_hand ?? product.total_count ?? 0),
    image_url: normalizeAssetUrl(product.shared_image_url || product.image_url || product.image || product.imageUrl || product.path || '')
  }

  return { ...mapped, group_key: makeGroupKey(mapped), variant_key: makeVariantKey(mapped) }
}

const flattenProducts = (items) => {
  const map = new Map()

  for (const product of Array.isArray(items) ? items : []) {
    const variants = Array.isArray(product.variants) ? product.variants : []

    if (variants.length) {
      for (const variant of variants) {
        const mapped = mapVariantRow(product, variant)
        if (mapped && !map.has(mapped.variant_key)) map.set(mapped.variant_key, mapped)
      }
    } else {
      const mapped = mapSingleRow(product)
      if (mapped && !map.has(mapped.variant_key)) map.set(mapped.variant_key, mapped)
    }
  }

  return Array.from(map.values())
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

const getCategorySource = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.tree)) return data.tree
  if (Array.isArray(data?.categories)) return data.categories
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.data)) return data.data
  return []
}

const flattenCategoryOptions = (data) => {
  const source = getCategorySource(data)
  if (!source.length) return []
  const result = []
  const hasNestedChildren = source.some((item) => Array.isArray(item?.children))
  if (hasNestedChildren) {
    const walk = (items, parentNames = [], inheritedGender = '') => {
      for (const item of Array.isArray(items) ? items : []) {
        if (!item || item.is_active === false) continue
        const children = (Array.isArray(item.children) ? item.children : []).filter((child) => child && child.is_active !== false)
        const name = cleanText(item.name)
        const names = [...parentNames, name].filter(Boolean)
        const gender = cleanText(item.gender || inheritedGender).toUpperCase()
        const label = cleanText(item.category_path || item.categoryPath) || names.join(' > ')
        const parentId = item.parent_id ?? item.parentId ?? null
        const selectable = item.selectable === true || (item.selectable !== false && children.length === 0 && parentId != null)
        if (selectable && item.id != null && label) result.push({ id: String(item.id), label, gender, sort_order: coerceNumber(item.sort_order) })
        if (children.length) walk(children, names, gender)
      }
    }
    walk(source)
  } else {
    const activeRows = source.filter((item) => item && item.is_active !== false)
    const parentIds = new Set()
    activeRows.forEach((item) => {
      const parentId = item.parent_id ?? item.parentId
      if (parentId != null) parentIds.add(String(parentId))
    })
    activeRows.forEach((item) => {
      const id = item.id != null ? String(item.id) : ''
      const parentId = item.parent_id ?? item.parentId ?? null
      const label = cleanText(item.category_path || item.categoryPath || item.name)
      const gender = cleanText(item.gender).toUpperCase()
      const selectable = item.selectable === true || (item.selectable !== false && parentId != null && !parentIds.has(id))
      if (id && label && selectable) result.push({ id, label, gender, sort_order: coerceNumber(item.sort_order) })
    })
  }
  const unique = new Map()
  result.forEach((item) => {
    if (!unique.has(item.id)) unique.set(item.id, item)
  })
  return Array.from(unique.values()).sort((a, b) => {
    const genderOrder = { MEN: 1, WOMEN: 2, KIDS: 3 }
    const ag = genderOrder[a.gender] || 9
    const bg = genderOrder[b.gender] || 9
    if (ag !== bg) return ag - bg
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })
}

const fetchJson = async (url, signal) => {
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: 'omit',
    mode: 'cors',
    signal,
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json()
}

const fetchAllCategories = async (signal) => {
  const data = await fetchJson(`${API_BASE}/api/categories/tree?_ts=${Date.now()}`, signal)
  return flattenCategoryOptions(data)
}

const fetchAllProducts = async (signal) => {
  const url = withBranch(`${API_BASE}/api/products?all=true&include_out_of_stock=true&include_grouped_values=true&group_by=design&_ts=${Date.now()}`)
  const data = await fetchJson(url, signal)
  return flattenProducts(getItemsFromResponse(data))
}

const deleteVariantRequest = async (item) => {
  const variantId = item?.variant_id || item?.id

  if (!variantId) throw new Error('Variant id missing')

  const query = new URLSearchParams()
  const branchId = getBranchId()

  if (branchId) query.set('branch_id', branchId)

  const suffix = query.toString() ? `?${query.toString()}` : ''

  const response = await fetch(`${API_BASE}/api/products/variant/${encodeURIComponent(variantId)}${suffix}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'omit',
    mode: 'cors'
  })

  if (!response.ok) {
    let message = 'Variant delete failed'

    try {
      const data = await response.json()
      message = data?.message || message
    } catch {}

    throw new Error(message)
  }

  return true
}

const selectedValuesFor = (choices, field, options) => {
  if (!options.length) return []
  if (options.length === 1) return [...options]
  if (!choices || !Object.prototype.hasOwnProperty.call(choices, field)) return [...options]

  const values = Array.isArray(choices[field]) ? choices[field] : []

  return values.filter((selected) => options.some((option) => normalizeKey(option) === normalizeKey(selected)))
}

const isValueSelected = (selected, value) => selected.some((item) => normalizeKey(item) === normalizeKey(value))

const matchesSelectedDimension = (value, selected, options) => {
  if (!options.length) return true
  if (!selected.length) return false
  return isValueSelected(selected, value)
}

const getUniformNumber = (variants, field, decimals = 2) => {
  const values = uniqueValues(variants.map((variant) => coerceNumber(variant[field]).toFixed(decimals)))

  if (!values.length) return Number(0).toFixed(decimals)
  if (values.length === 1) return Number(values[0]).toFixed(decimals)

  return 'Mixed'
}

const sumField = (variants, field) => variants.reduce((total, variant) => total + coerceNumber(variant[field]), 0)

const getFinalPriceDisplay = (variants) => {
  const values = uniqueValues(variants.map((variant) => computeFinal(variant.original_price_b2c, variant.discount_b2c).toFixed(2)))

  if (!values.length) return '0.00'
  if (values.length === 1) return Number(values[0]).toFixed(2)

  return 'Mixed'
}

const DropdownCell = ({ title, options, selected, onToggle, onToggleAll }) => {
  if (!options.length) return <span>-</span>

  if (options.length === 1) {
    return <span className="single-value-pill-vandana">{options[0]}</span>
  }

  const allSelected = selected.length === options.length
  const summary = allSelected ? `All (${options.length})` : selected.length ? `${selected.length} selected` : `Select ${title}`

  return (
    <details className="variant-dropdown-vandana">
      <summary>{summary} ▾</summary>
      <div className="variant-dropdown-menu-vandana">
        <label className="variant-dropdown-all-vandana"><input type="checkbox" checked={allSelected} onChange={onToggleAll} /><span>All</span></label>
        {options.map((option) => <label key={option}><input type="checkbox" checked={isValueSelected(selected, option)} onChange={() => onToggle(option)} /><span>{option}</span></label>)}
      </div>
    </details>
  )
}

const DeleteProduct = () => {
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [isLoading, setIsLoading] = useState(false)
  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [confirmItems, setConfirmItems] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedMap, setSelectedMap] = useState({})
  const [variantChoices, setVariantChoices] = useState({})
  const [currentPage, setCurrentPage] = useState(1)

  const requestIdRef = useRef(0)
  const abortRef = useRef(null)
  const popupTimerRef = useRef(null)

  const showPopup = useCallback((message, type = 'success', time = 2200) => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)

    setPopupMessage(message)
    setPopupType(type)

    popupTimerRef.current = setTimeout(() => {
      setPopupMessage('')
      popupTimerRef.current = null
    }, time)
  }, [])

  const fetchCategories = useCallback(async (signal) => {
    try {
      const items = await fetchAllCategories(signal)
      setCategories(items)
    } catch (error) {
      if (error?.name === 'AbortError') return
      setCategories([])
    }
  }, [])

  const fetchAll = useCallback(async (force = false) => {
    const branchId = getBranchId()
    const now = Date.now()
    if (!force && productRowsCache.rows.length && productRowsCache.branchId === branchId && now - productRowsCache.timestamp < CACHE_TTL) {
      setRows(productRowsCache.rows)
      setIsLoading(false)
      return
    }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    if (force) setRows([])
    try {
      const allRows = await fetchAllProducts(controller.signal)
      if (requestId !== requestIdRef.current || controller.signal.aborted) return
      setRows(allRows)
      productRowsCache = { branchId, timestamp: Date.now(), rows: allRows }
      setSelectedMap({})
      setVariantChoices({})
      setCurrentPage(1)
    } catch (error) {
      if (error?.name === 'AbortError') return
      if (requestId === requestIdRef.current) {
        setRows([])
        setSelectedMap({})
        setVariantChoices({})
        showPopup(error?.message || 'Unable to load products', 'error', 3000)
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [showPopup])

  useEffect(() => {
    const categoryController = new AbortController()
    fetchAll(false)
    fetchCategories(categoryController.signal)
    return () => {
      categoryController.abort()
      if (abortRef.current) abortRef.current.abort()
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    }
  }, [fetchAll, fetchCategories])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [searchInput])

  const categoryFilterOptions = useMemo(() => {
    const gender = filter === 'Men' ? 'MEN' : filter === 'Women' ? 'WOMEN' : filter === 'Kids' ? 'KIDS' : ''
    return categories
      .filter((category) => !gender || category.gender === gender)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.label.localeCompare(b.label, undefined, { numeric: true })
      })
  }, [categories, filter])

  useEffect(() => {
    setCategoryFilter('All')
    setCurrentPage(1)
  }, [filter])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, search, sortBy])

  const filteredSortedRows = useMemo(() => {
    let list = rows

    if (filter === 'Men') list = list.filter((row) => String(row.category || '').toLowerCase() === 'men')
    else if (filter === 'Women') list = list.filter((row) => String(row.category || '').toLowerCase() === 'women')
    else if (filter === 'Kids') list = list.filter((row) => String(row.category || '').toLowerCase().startsWith('kids'))

    if (categoryFilter !== 'All') list = list.filter((row) => String(row.category_id || '') === String(categoryFilter))

    if (search) {
      list = list.filter((row) => {
        const haystack = [row.brand, row.product_name, row.design_code, row.pattern_type, row.pattern_code, row.color, row.size, row.barcode, row.category, row.category_name, row.parent_category_name, row.category_path].map((value) => String(value || '').toLowerCase()).join(' ')
        return haystack.includes(search)
      })
    }

    const sorted = [...list]

    if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const av = Number(a.product_id || a.id) || 0
        const bv = Number(b.product_id || b.id) || 0

        if (bv !== av) return bv - av

        return (Number(b.variant_id) || 0) - (Number(a.variant_id) || 0)
      })
    } else if (sortBy === 'price_b2c_asc') {
      sorted.sort((a, b) => computeFinal(a.original_price_b2c, a.discount_b2c) - computeFinal(b.original_price_b2c, b.discount_b2c))
    } else if (sortBy === 'price_b2c_desc') {
      sorted.sort((a, b) => computeFinal(b.original_price_b2c, b.discount_b2c) - computeFinal(a.original_price_b2c, a.discount_b2c))
    } else if (sortBy === 'stock_desc') {
      sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count))
    } else if (sortBy === 'brand_asc') {
      sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')))
    }

    return sorted
  }, [rows, filter, categoryFilter, search, sortBy])

  const groupedRows = useMemo(() => {
    const groupMap = new Map()

    for (const row of filteredSortedRows) {
      const key = row.group_key

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          group_key: key,
          product_id: row.product_id,
          category: row.category,
          category_id: row.category_id,
          category_name: row.category_name,
          parent_category_name: row.parent_category_name,
          category_path: row.category_path,
          brand: row.brand,
          product_name: row.product_name,
          variantMap: new Map()
        })
      }

      groupMap.get(key).variantMap.set(row.variant_key, row)
    }

    return Array.from(groupMap.values()).map((group) => {
      const variants = Array.from(group.variantMap.values())
      const designCodes = uniqueValues(variants.map((variant) => variant.design_code))
      const patternTypes = uniqueValues(variants.map((variant) => variant.pattern_type))
      const patternCodes = uniqueValues(variants.map((variant) => variant.pattern_code))
      const colors = uniqueValues(variants.map((variant) => variant.color))
      const sizes = uniqueValues(variants.map((variant) => variant.size))
      const choice = variantChoices[group.group_key] || {}
      const selectedDesignCodes = selectedValuesFor(choice, 'designCodes', designCodes)
      const selectedPatternTypes = selectedValuesFor(choice, 'patternTypes', patternTypes)
      const selectedPatternCodes = selectedValuesFor(choice, 'patternCodes', patternCodes)
      const selectedColors = selectedValuesFor(choice, 'colors', colors)
      const selectedSizes = selectedValuesFor(choice, 'sizes', sizes)

      const matchingVariants = variants.filter((variant) =>
        matchesSelectedDimension(variant.design_code, selectedDesignCodes, designCodes) &&
        matchesSelectedDimension(variant.pattern_type, selectedPatternTypes, patternTypes) &&
        matchesSelectedDimension(variant.pattern_code, selectedPatternCodes, patternCodes) &&
        matchesSelectedDimension(variant.color, selectedColors, colors) &&
        matchesSelectedDimension(variant.size, selectedSizes, sizes)
      )

      const displayVariants = matchingVariants.length ? matchingVariants : variants
      const images = uniqueValues(displayVariants.map((variant) => variant.image_url).filter(Boolean))

      return {
        group_key: group.group_key,
        product_id: group.product_id,
        category: group.category,
        category_id: group.category_id,
        category_name: group.category_name,
        parent_category_name: group.parent_category_name,
        category_path: group.category_path,
        brand: group.brand,
        product_name: group.product_name,
        variants,
        designCodes,
        patternTypes,
        patternCodes,
        colors,
        sizes,
        selectedDesignCodes,
        selectedPatternTypes,
        selectedPatternCodes,
        selectedColors,
        selectedSizes,
        matchingVariants,
        displayVariants,
        image_url: images[0] || '',
        different_images: images.length,
        original_price_display: getUniformNumber(displayVariants, 'original_price_b2c'),
        discount_display: getUniformNumber(displayVariants, 'discount_b2c'),
        final_price_display: getFinalPriceDisplay(displayVariants),
        stock_display: sumField(displayVariants, 'total_count'),
        reserved_display: sumField(displayVariants, 'reserved_count')
      }
    })
  }, [filteredSortedRows, variantChoices])

  const totalTablePages = Math.max(1, Math.ceil(groupedRows.length / TABLE_PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalTablePages) setCurrentPage(totalTablePages)
  }, [currentPage, totalTablePages])

  const visibleGroups = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE
    return groupedRows.slice(start, start + TABLE_PAGE_SIZE)
  }, [groupedRows, currentPage])

  const selectedItems = useMemo(() => Object.values(selectedMap), [selectedMap])

  const removeSelectionsForGroup = (groupKey) => {
    setSelectedMap((previous) => {
      const next = {}

      for (const [key, value] of Object.entries(previous)) {
        if (value.group_key !== groupKey) next[key] = value
      }

      return next
    })
  }

  const updateDimension = (group, field, options, value) => {
    setVariantChoices((previous) => {
      const currentChoice = previous[group.group_key] || {}
      const currentValues = selectedValuesFor(currentChoice, field, options)
      const nextValues = isValueSelected(currentValues, value) ? currentValues.filter((item) => normalizeKey(item) !== normalizeKey(value)) : uniqueValues([...currentValues, value])

      return {
        ...previous,
        [group.group_key]: {
          ...currentChoice,
          [field]: nextValues
        }
      }
    })

    removeSelectionsForGroup(group.group_key)
  }

  const toggleAllDimension = (group, field, options) => {
    setVariantChoices((previous) => {
      const currentChoice = previous[group.group_key] || {}
      const currentValues = selectedValuesFor(currentChoice, field, options)
      const allSelected = currentValues.length === options.length

      return {
        ...previous,
        [group.group_key]: {
          ...currentChoice,
          [field]: allSelected ? [] : [...options]
        }
      }
    })

    removeSelectionsForGroup(group.group_key)
  }

  const askDelete = (items) => {
    const dedupe = new Map()

    for (const item of Array.isArray(items) ? items : []) {
      if (!item || !item.variant_id) continue
      dedupe.set(item.variant_key, item)
    }

    const validItems = Array.from(dedupe.values())

    if (!validItems.length) {
      showPopup('Select at least one colour and size', 'error', 2600)
      return
    }

    setConfirmItems(validItems)
    setShowConfirm(true)
  }

  const confirmDelete = async (confirmed) => {
    setShowConfirm(false)

    if (!confirmed) {
      setConfirmItems([])
      return
    }

    if (!confirmItems.length) return

    const results = await Promise.allSettled(confirmItems.map((item) => deleteVariantRequest(item)))
    const deletedItems = []
    const failedItems = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') deletedItems.push(confirmItems[index])
      else failedItems.push({ item: confirmItems[index], error: result.reason })
    })

    if (deletedItems.length) {
      const deletedKeys = new Set(deletedItems.map((item) => item.variant_key))

      setRows((previous) => {
        const next = previous.filter((row) => !deletedKeys.has(row.variant_key))

        productRowsCache = {
          branchId: getBranchId(),
          timestamp: Date.now(),
          rows: next
        }

        return next
      })

      setSelectedMap((previous) => {
        const next = { ...previous }

        for (const item of deletedItems) delete next[item.variant_key]

        return next
      })
    }

    if (deletedItems.length && !failedItems.length) {
      showPopup(deletedItems.length === 1 ? 'Variant deleted successfully' : `${deletedItems.length} variants deleted successfully`, 'success', 2600)
    } else if (deletedItems.length && failedItems.length) {
      showPopup(`Deleted ${deletedItems.length}. Failed ${failedItems.length}.`, 'error', 3200)
    } else {
      showPopup(failedItems[0]?.error?.message || 'Delete failed', 'error', 3000)
    }

    setConfirmItems([])
  }

  const toggleGroupSelection = (group) => {
    const variants = group.matchingVariants

    if (!variants.length) {
      showPopup('Select at least one colour and size', 'error', 2400)
      return
    }

    const allSelected = variants.every((variant) => Boolean(selectedMap[variant.variant_key]))

    setSelectedMap((previous) => {
      const next = { ...previous }

      if (allSelected) {
        for (const variant of variants) delete next[variant.variant_key]
      } else {
        for (const variant of variants) next[variant.variant_key] = variant
      }

      return next
    })
  }

  const allVisibleVariants = useMemo(() => {
    const map = new Map()

    for (const group of visibleGroups) {
      for (const variant of group.matchingVariants) {
        map.set(variant.variant_key, variant)
      }
    }

    return Array.from(map.values())
  }, [visibleGroups])

  const allVisibleSelected = allVisibleVariants.length > 0 && allVisibleVariants.every((variant) => Boolean(selectedMap[variant.variant_key]))

  const toggleSelectAllVisible = () => {
    if (!allVisibleVariants.length) return

    setSelectedMap((previous) => {
      const next = { ...previous }

      if (allVisibleSelected) {
        for (const variant of allVisibleVariants) delete next[variant.variant_key]
      } else {
        for (const variant of allVisibleVariants) next[variant.variant_key] = variant
      }

      return next
    })
  }

  const goToPage = (page) => {
    const next = Math.min(totalTablePages, Math.max(1, page))
    setCurrentPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="delete-product-page-vandana">
      <div className="delete-toolbar-vandana">
        <div className="filters-vandana">
          {['All', 'Men', 'Women', 'Kids'].map((item) => <button key={item} className={`chip-vandana ${filter === item ? 'active-vandana' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}
        </div>

        <div className="tools-vandana">
          <input className="search-input-vandana" placeholder="Search by product, design code, pattern type, category, colour, size or barcode" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />

          <select className="sort-select-vandana" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">All Sub-categories</option>
            {categoryFilterOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>

          <select className="sort-select-vandana" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="price_b2c_asc">Price B2C: Low to High</option>
            <option value="price_b2c_desc">Price B2C: High to Low</option>
            <option value="stock_desc">Stock: High to Low</option>
            <option value="brand_asc">Brand: A to Z</option>
          </select>

          <button className="refresh-btn-vandana" onClick={() => { fetchAll(true); fetchCategories() }} disabled={isLoading}>{isLoading ? 'Loading...' : 'Refresh'}</button>
          <button className="danger-btn-vandana" onClick={() => askDelete(selectedItems)}>Delete Selected{selectedItems.length ? ` (${selectedItems.length})` : ''}</button>
        </div>
      </div>

      <div className="delete-section2-vandana">
        <div className="table-title-row-vandana">
          <h2>Product Table ({groupedRows.length})</h2>
          {groupedRows.length ? <span>Showing {Math.min((currentPage - 1) * TABLE_PAGE_SIZE + 1, groupedRows.length)} - {Math.min(currentPage * TABLE_PAGE_SIZE, groupedRows.length)} of {groupedRows.length}</span> : null}
        </div>

        <div className="table-scroll-wrapper-vandana">
          <table className="table-vandana">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} disabled={!allVisibleVariants.length} aria-label="Select all visible variants" /></th>
                <th>Sl. No</th>
                <th>Gender</th>
                <th>Sub-category</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Design Code</th>
                <th>Pattern Type</th>
                <th>Pattern Code</th>
                <th>Colors</th>
                <th>Sizes</th>
                <th>Original Price</th>
                <th>Discount %</th>
                <th>Final Price</th>
                <th>Stock</th>
                <th>Reserved</th>
                <th>Image</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {visibleGroups.map((group, index) => {
                const groupAllSelected = group.matchingVariants.length > 0 && group.matchingVariants.every((variant) => Boolean(selectedMap[variant.variant_key]))

                return (
                  <tr key={group.group_key}>
                    <td><input type="checkbox" checked={groupAllSelected} disabled={!group.matchingVariants.length} onChange={() => toggleGroupSelection(group)} aria-label={`Select ${group.product_name}`} /></td>
                    <td>{(currentPage - 1) * TABLE_PAGE_SIZE + index + 1}</td>
                    <td>{group.category || '-'}</td>
                    <td>{group.category_path || [group.parent_category_name, group.category_name].filter(Boolean).join(' > ') || '-'}</td>
                    <td>{group.brand || '-'}</td>
                    <td><div className="product-name-main-vandana">{group.product_name}</div><div className="product-id-vandana">Product ID: {group.product_id}</div></td>
                    <td><DropdownCell title="design" options={group.designCodes} selected={group.selectedDesignCodes} onToggle={(value) => updateDimension(group, 'designCodes', group.designCodes, value)} onToggleAll={() => toggleAllDimension(group, 'designCodes', group.designCodes)} /></td>
                    <td><DropdownCell title="pattern" options={group.patternTypes} selected={group.selectedPatternTypes} onToggle={(value) => updateDimension(group, 'patternTypes', group.patternTypes, value)} onToggleAll={() => toggleAllDimension(group, 'patternTypes', group.patternTypes)} /></td>
                    <td><DropdownCell title="pattern code" options={group.patternCodes} selected={group.selectedPatternCodes} onToggle={(value) => updateDimension(group, 'patternCodes', group.patternCodes, value)} onToggleAll={() => toggleAllDimension(group, 'patternCodes', group.patternCodes)} /></td>
                    <td><DropdownCell title="colors" options={group.colors} selected={group.selectedColors} onToggle={(value) => updateDimension(group, 'colors', group.colors, value)} onToggleAll={() => toggleAllDimension(group, 'colors', group.colors)} /></td>
                    <td><DropdownCell title="sizes" options={group.sizes} selected={group.selectedSizes} onToggle={(value) => updateDimension(group, 'sizes', group.sizes, value)} onToggleAll={() => toggleAllDimension(group, 'sizes', group.sizes)} /></td>
                    <td>{group.original_price_display}</td>
                    <td>{group.discount_display}</td>
                    <td>{group.final_price_display}</td>
                    <td>{group.stock_display}</td>
                    <td>{group.reserved_display}</td>
                    <td>{group.image_url ? <div className="image-cell-vandana"><img src={group.image_url} alt={group.product_name} loading="lazy" decoding="async" className="table-image-vandana" />{group.different_images > 1 ? <span>+{group.different_images - 1}</span> : null}</div> : <div className="table-image-placeholder-vandana">No Image</div>}</td>
                    <td><button className="delete-btn-vandana" disabled={!group.matchingVariants.length} onClick={() => askDelete(group.matchingVariants)}>Delete{group.matchingVariants.length > 1 ? ` (${group.matchingVariants.length})` : ''}</button></td>
                  </tr>
                )
              })}

              {!visibleGroups.length && !isLoading ? <tr><td colSpan="18" className="empty-cell-vandana">No products found</td></tr> : null}
              {isLoading ? <tr><td colSpan="18" className="empty-cell-vandana">Loading products...</td></tr> : null}
            </tbody>
          </table>
        </div>

        {groupedRows.length > TABLE_PAGE_SIZE ? (
          <div className="pagination-vandana">
            <button type="button" className="refresh-btn-vandana" disabled={currentPage === 1} onClick={() => goToPage(1)}>First</button>
            <button type="button" className="refresh-btn-vandana" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {totalTablePages}</span>
            <button type="button" className="refresh-btn-vandana" disabled={currentPage === totalTablePages} onClick={() => goToPage(currentPage + 1)}>Next</button>
            <button type="button" className="refresh-btn-vandana" disabled={currentPage === totalTablePages} onClick={() => goToPage(totalTablePages)}>Last</button>
          </div>
        ) : null}
      </div>

      {popupMessage ? <div className={`popup-card-vandana ${popupType}`}>{popupMessage}</div> : null}

      {showConfirm ? (
        <div className="popup-confirm-overlay-vandana">
          <div className="popup-confirm-box-vandana">
            <p className="confirm-title-vandana">{confirmItems.length > 1 ? `Delete ${confirmItems.length} selected variants?` : 'Delete this variant?'}</p>
            <div className="confirm-warning-vandana">{confirmItems.length} variant{confirmItems.length === 1 ? '' : 's'} will be deleted.</div>

            <div className="confirm-products-vandana">
              {confirmItems.map((item) => (
                <div className="confirm-product-card-vandana" key={item.variant_key}>
                  {item.image_url ? <img src={item.image_url} alt={item.product_name} loading="lazy" decoding="async" className="confirm-image-vandana" /> : <div className="confirm-image-placeholder-vandana">No Image</div>}

                  <div className="confirm-details-vandana">
                    <strong>{item.product_name}</strong>
                    <span>Brand: {item.brand || '-'}</span>
                    <span>Gender: {item.category || '-'}</span>
                    <span>Sub-category: {item.category_path || item.category_name || '-'}</span>
                    <span>Design Code: {item.design_code || '-'}</span>
                    <span>Pattern Type: {item.pattern_type || '-'}</span>
                    <span>Pattern Code: {item.pattern_code || '-'}</span>
                    <span>Color: {item.color || '-'}</span>
                    <span>Size: {item.size || '-'}</span>
                    <span>Barcode: {item.barcode || '-'}</span>
                    <span>Stock: {item.total_count ?? 0}</span>
                    <span>Reserved: {item.reserved_count ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="popup-actions-vandana">
              <button onClick={() => confirmDelete(true)}>Yes, Delete{confirmItems.length > 1 ? ` ${confirmItems.length} Variants` : ''}</button>
              <button onClick={() => confirmDelete(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DeleteProduct
