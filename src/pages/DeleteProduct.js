import React, { useEffect, useMemo, useState } from 'react'
import './DeleteProduct.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const DEFAULT_ASSETS_BASE = 'https://vandhana-shopping-mall-backend.vercel.app/uploads'

const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE

const ASSETS_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ASSETS_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_ASSETS_BASE) ||
  DEFAULT_ASSETS_BASE

const API_BASE = API_BASE_RAW.replace(/\/+$/, '')
const ASSETS_BASE = ASSETS_BASE_RAW.replace(/\/+$/, '')

const coerceNumber = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '').trim())
  return Number.isFinite(n) ? n : 0
}

const cleanText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

const normalizeKey = (v) => cleanText(v).toLowerCase()

const hasGroupedVariantValue = (v) => cleanText(v).includes(',')

const getBranchId = () => {
  if (typeof window === 'undefined') return ''
  return (
    localStorage.getItem('branch_id') ||
    localStorage.getItem('branchId') ||
    localStorage.getItem('selectedBranchId') ||
    ''
  )
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

const withBranch = (url) => {
  const branchId = getBranchId()
  if (!branchId) return url
  return `${url}${url.includes('?') ? '&' : '?'}branch_id=${encodeURIComponent(branchId)}`
}

const normalizeAssetUrl = (maybeRelative) => {
  if (!maybeRelative) return ''
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  const base = ASSETS_BASE || API_BASE
  const needsSlash = !maybeRelative.startsWith('/')
  return `${base}${needsSlash ? '/' : ''}${maybeRelative}`
}

const computeFinal = (price, discount) => {
  const p = coerceNumber(price)
  const d = coerceNumber(discount)
  return Number((p - (p * d) / 100).toFixed(2))
}

const makeGroupKey = (row) =>
  [
    cleanText(row.product_id),
    normalizeKey(row.category),
    normalizeKey(row.category_id),
    normalizeKey(row.brand),
    normalizeKey(row.product_name)
  ].join('||')

const makeVariantKey = (row) =>
  cleanText(row.variant_id || row.id) ||
  [
    makeGroupKey(row),
    normalizeKey(row.color),
    normalizeKey(row.size),
    normalizeKey(row.barcode)
  ].join('||')

const mapVariantRow = (product, variant) => {
  const productId = product.product_id ?? product.id ?? variant.product_id ?? ''
  const variantId = variant.variant_id ?? variant.id ?? ''
  const color = cleanText(variant.color || variant.colour)
  const size = cleanText(variant.size)

  if (!variantId || !color || !size) return null
  if (hasGroupedVariantValue(color) || hasGroupedVariantValue(size)) return null

  const originalPriceB2c =
    variant.original_price_b2c ??
    variant.mrp ??
    variant.price ??
    variant.sale_price ??
    product.original_price_b2c ??
    product.mrp ??
    product.price ??
    0

  const discountB2c =
    variant.discount_b2c ??
    variant.b2c_discount_pct ??
    product.discount_b2c ??
    product.b2c_discount_pct ??
    0

  const originalPriceB2b =
    variant.original_price_b2b ??
    variant.cost_price ??
    variant.original_price_b2c ??
    product.original_price_b2b ??
    product.original_price_b2c ??
    0

  const discountB2b =
    variant.discount_b2b ??
    variant.b2b_discount_pct ??
    product.discount_b2b ??
    product.b2b_discount_pct ??
    0

  const mapped = {
    id: variantId,
    variant_id: variantId,
    product_id: productId,
    category: cleanText(product.category || product.gender),
    category_id: product.category_id || variant.category_id || '',
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
    final_price_b2b: coerceNumber(variant.final_price_b2b || product.final_price_b2b),
    original_price_b2c: coerceNumber(originalPriceB2c),
    discount_b2c: coerceNumber(discountB2c),
    final_price_b2c: coerceNumber(variant.final_price_b2c || product.final_price_b2c),
    total_count: coerceNumber(variant.on_hand ?? variant.total_count ?? variant.available_qty ?? 0),
    image_url: normalizeAssetUrl(variant.image_url || product.image_url || product.image || product.imageUrl || product.path || '')
  }

  return {
    ...mapped,
    group_key: makeGroupKey(mapped),
    variant_key: makeVariantKey(mapped)
  }
}

const mapSingleRow = (p) => {
  const productId = p.product_id ?? p.id ?? p._id ?? p.uuid ?? ''
  const variantId = p.variant_id ?? p.primary_variant_id ?? p.id ?? ''
  const color = cleanText(p.color || p.colour)
  const size = cleanText(p.size)

  if (!variantId || !color || !size) return null
  if (hasGroupedVariantValue(color) || hasGroupedVariantValue(size)) return null

  const mapped = {
    id: variantId,
    variant_id: variantId,
    product_id: productId,
    category: cleanText(p.category || p.gender),
    category_id: p.category_id || '',
    category_name: cleanText(p.category_name),
    category_slug: cleanText(p.category_slug),
    parent_category_name: cleanText(p.parent_category_name),
    category_path: cleanText(p.category_path),
    brand: cleanText(p.brand || p.brand_name),
    product_name: cleanText(p.product_name || p.name),
    design_code: cleanText(p.design_code || p.designCode),
    pattern_type: cleanText(p.pattern_type || p.patternType),
    pattern_code: cleanText(p.pattern_code || p.patternCode),
    color,
    colour: color,
    size,
    barcode: cleanText(p.barcode || p.ean_code),
    original_price_b2b: coerceNumber(p.original_price_b2b),
    discount_b2b: coerceNumber(p.discount_b2b || p.b2b_discount_pct),
    final_price_b2b: coerceNumber(p.final_price_b2b),
    original_price_b2c: coerceNumber(p.original_price_b2c || p.mrp),
    discount_b2c: coerceNumber(p.discount_b2c || p.b2c_discount_pct),
    final_price_b2c: coerceNumber(p.final_price_b2c),
    total_count: coerceNumber(p.total_count || p.on_hand || p.available_qty),
    image_url: normalizeAssetUrl(p.image_url || p.image || p.imageUrl || p.path || '')
  }

  return {
    ...mapped,
    group_key: makeGroupKey(mapped),
    variant_key: makeVariantKey(mapped)
  }
}

const flattenProducts = (items) => {
  const out = []

  for (const product of Array.isArray(items) ? items : []) {
    const variants = Array.isArray(product.variants) ? product.variants : []

    if (variants.length) {
      for (const variant of variants) {
        const mapped = mapVariantRow(product, variant)
        if (mapped) out.push(mapped)
      }
    } else {
      const mapped = mapSingleRow(product)
      if (mapped) out.push(mapped)
    }
  }

  const seen = new Set()

  return out.filter((item) => {
    const key = item.variant_key
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: 'omit',
    mode: 'cors'
  })
  if (!res.ok) throw new Error('Request failed')
  return await res.json()
}

const fetchAllProducts = async () => {
  const directUrls = [
    withBranch(`${API_BASE}/api/products?all=true&limit=50000`),
    withBranch(`${API_BASE}/api/products?limit=50000`),
    withBranch(`${API_BASE}/api/products`)
  ]

  for (const url of directUrls) {
    try {
      const data = await fetchJson(url)
      const items = getItemsFromResponse(data)
      const rows = flattenProducts(items)
      if (rows.length > 0) return rows
    } catch {}
  }

  return []
}

const uniqueValues = (values) => {
  const seen = new Set()
  const result = []

  values.forEach((value) => {
    const text = cleanText(value)
    const key = normalizeKey(text)
    if (text && !seen.has(key)) {
      seen.add(key)
      result.push(text)
    }
  })

  return result.sort((a, b) => {
    const na = parseFloat(String(a).replace(/[^\d.]/g, ''))
    const nb = parseFloat(String(b).replace(/[^\d.]/g, ''))
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return String(a).localeCompare(String(b), undefined, { numeric: true })
  })
}

const buildDeleteItem = (group, color, size) => {
  const variant =
    group.variants.find(
      (v) => normalizeKey(v.color) === normalizeKey(color) && normalizeKey(v.size) === normalizeKey(size)
    ) ||
    group.variants.find((v) => normalizeKey(v.color) === normalizeKey(color)) ||
    group.variants[0]

  if (!variant) return null

  return {
    ...variant,
    color: cleanText(color || variant.color),
    colour: cleanText(color || variant.color),
    size: cleanText(size || variant.size),
    group_key: group.group_key,
    variant_key: makeVariantKey({
      ...variant,
      color: cleanText(color || variant.color),
      size: cleanText(size || variant.size)
    })
  }
}

const deleteVariantRequest = async (item) => {
  const variantId = item.variant_id || item.id

  if (!variantId) throw new Error('Variant id missing')

  const query = new URLSearchParams()
  const branchId = getBranchId()

  if (branchId) query.set('branch_id', branchId)

  const suffix = query.toString() ? `?${query.toString()}` : ''

  const res = await fetch(`${API_BASE}/api/products/variant/${encodeURIComponent(variantId)}${suffix}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'omit',
    mode: 'cors'
  })

  if (!res.ok) {
    let message = 'Variant delete failed'

    try {
      const data = await res.json()
      message = data?.message || message
    } catch {}

    throw new Error(message)
  }

  return true
}

const DeleteProduct = () => {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [isLoading, setIsLoading] = useState(false)
  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [confirmItems, setConfirmItems] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedMap, setSelectedMap] = useState({})
  const [variantChoices, setVariantChoices] = useState({})

  const showPopup = (message, type = 'success', time = 1800) => {
    setPopupMessage(message)
    setPopupType(type)
    setTimeout(() => setPopupMessage(''), time)
  }

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const allRows = await fetchAllProducts()
      setRows(allRows)
      setSelectedMap({})
      setVariantChoices({})
    } catch {
      setRows([])
      setSelectedMap({})
      setVariantChoices({})
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const categoryFilterOptions = useMemo(() => {
    const list = rows
      .filter(r => {
        if (filter === 'Men') return r.category.toLowerCase() === 'men'
        if (filter === 'Women') return r.category.toLowerCase() === 'women'
        if (filter === 'Kids') return r.category.toLowerCase().startsWith('kids')
        return true
      })
      .map(r => ({
        id: String(r.category_id || ''),
        label: r.category_path || [r.parent_category_name, r.category_name].filter(Boolean).join(' > ') || r.category_name
      }))
      .filter(x => x.id && x.label)

    const seen = new Set()
    return list.filter(x => {
      if (seen.has(x.id)) return false
      seen.add(x.id)
      return true
    })
  }, [rows, filter])

  useEffect(() => {
    setCategoryFilter('All')
  }, [filter])

  const filteredSortedRows = useMemo(() => {
    let list = rows

    if (filter === 'Men') list = list.filter((r) => r.category.toLowerCase() === 'men')
    else if (filter === 'Women') list = list.filter((r) => r.category.toLowerCase() === 'women')
    else if (filter === 'Kids') list = list.filter((r) => r.category.toLowerCase().startsWith('kids'))

    if (categoryFilter !== 'All') {
      list = list.filter((r) => String(r.category_id || '') === String(categoryFilter))
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.brand || '').toLowerCase().includes(q) ||
          (r.product_name || '').toLowerCase().includes(q) ||
          (r.design_code || '').toLowerCase().includes(q) ||
          (r.pattern_type || '').toLowerCase().includes(q) ||
          (r.pattern_code || '').toLowerCase().includes(q) ||
          (r.color || '').toLowerCase().includes(q) ||
          (r.size || '').toLowerCase().includes(q) ||
          (r.barcode || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          (r.category_name || '').toLowerCase().includes(q) ||
          (r.parent_category_name || '').toLowerCase().includes(q) ||
          (r.category_path || '').toLowerCase().includes(q)
      )
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
      sorted.sort(
        (a, b) => computeFinal(a.original_price_b2c, a.discount_b2c) - computeFinal(b.original_price_b2c, b.discount_b2c)
      )
    } else if (sortBy === 'price_b2c_desc') {
      sorted.sort(
        (a, b) => computeFinal(b.original_price_b2c, b.discount_b2c) - computeFinal(a.original_price_b2c, a.discount_b2c)
      )
    } else if (sortBy === 'stock_desc') {
      sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count))
    } else if (sortBy === 'brand_asc') {
      sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')))
    }

    return sorted
  }, [rows, filter, categoryFilter, search, sortBy])

  const groupedRows = useMemo(() => {
    const groupMap = new Map()

    filteredSortedRows.forEach((row) => {
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
          design_code: row.design_code,
          pattern_type: row.pattern_type,
          pattern_code: row.pattern_code,
          image_url: row.image_url,
          variants: []
        })
      }

      const group = groupMap.get(key)

      if (!group.variants.some((v) => v.variant_key === row.variant_key)) {
        group.variants.push(row)
      }
    })

    return Array.from(groupMap.values()).map((group) => {
      const colors = uniqueValues(group.variants.map((v) => v.color))
      const fallbackColor = colors[0] || ''
      const savedColor = variantChoices[group.group_key]?.color
      const selectedColor = colors.some((c) => normalizeKey(c) === normalizeKey(savedColor)) ? savedColor : fallbackColor

      const sizes = uniqueValues(
        group.variants
          .filter((v) => normalizeKey(v.color) === normalizeKey(selectedColor))
          .map((v) => v.size)
      )

      const fallbackSize = sizes[0] || ''
      const savedSize = variantChoices[group.group_key]?.size
      const selectedSize = sizes.some((s) => normalizeKey(s) === normalizeKey(savedSize)) ? savedSize : fallbackSize
      const currentItem = buildDeleteItem(group, selectedColor, selectedSize)

      return {
        ...group,
        colors,
        sizes,
        selectedColor,
        selectedSize,
        currentItem
      }
    })
  }, [filteredSortedRows, variantChoices])

  const selectedItems = useMemo(() => Object.values(selectedMap), [selectedMap])

  const removeSelectionsForGroup = (groupKey) => {
    setSelectedMap((prev) => {
      const next = {}
      Object.entries(prev).forEach(([key, value]) => {
        if (value.group_key !== groupKey) next[key] = value
      })
      return next
    })
  }

  const handleColorChange = (group, color) => {
    const sizes = uniqueValues(
      group.variants
        .filter((v) => normalizeKey(v.color) === normalizeKey(color))
        .map((v) => v.size)
    )

    setVariantChoices((prev) => ({
      ...prev,
      [group.group_key]: {
        color,
        size: sizes[0] || ''
      }
    }))

    removeSelectionsForGroup(group.group_key)
  }

  const handleSizeChange = (group, size) => {
    setVariantChoices((prev) => ({
      ...prev,
      [group.group_key]: {
        color: group.selectedColor,
        size
      }
    }))

    removeSelectionsForGroup(group.group_key)
  }

  const askDelete = (items) => {
    const validItems = items.filter(Boolean)

    if (!validItems.length) {
      showPopup('Select at least one product', 'error')
      return
    }

    const invalid = validItems.find((item) => !cleanText(item.color) || !cleanText(item.size) || !cleanText(item.variant_id))

    if (invalid) {
      showPopup('Select color and size before deleting', 'error', 2000)
      return
    }

    setConfirmItems(validItems)
    setShowConfirm(true)
  }

  const confirmDelete = async (ok) => {
    setShowConfirm(false)

    if (!ok) {
      setConfirmItems([])
      return
    }

    try {
      await Promise.all(confirmItems.map((item) => deleteVariantRequest(item)))

      const deletedKeys = new Set(confirmItems.map((item) => item.variant_key))

      setRows((prev) => prev.filter((row) => !deletedKeys.has(row.variant_key)))

      setSelectedMap((prev) => {
        const next = { ...prev }
        confirmItems.forEach((item) => {
          delete next[item.variant_key]
        })
        return next
      })

      showPopup(confirmItems.length > 1 ? 'Selected variants deleted successfully' : 'Variant deleted successfully', 'success')
    } catch (err) {
      showPopup(err?.message || 'Delete failed', 'error', 2400)
    } finally {
      setConfirmItems([])
    }
  }

  const toggleSelect = (item) => {
    if (!item) return

    setSelectedMap((prev) => {
      const next = { ...prev }

      if (next[item.variant_key]) {
        delete next[item.variant_key]
      } else {
        next[item.variant_key] = item
      }

      return next
    })
  }

  const toggleSelectAllVisible = () => {
    const visibleItems = groupedRows.map((group) => group.currentItem).filter(Boolean)
    const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedMap[item.variant_key])

    setSelectedMap((prev) => {
      const next = { ...prev }

      if (allSelected) {
        visibleItems.forEach((item) => {
          delete next[item.variant_key]
        })
      } else {
        visibleItems.forEach((item) => {
          if (cleanText(item.color) && cleanText(item.size) && cleanText(item.variant_id)) {
            next[item.variant_key] = item
          }
        })
      }

      return next
    })
  }

  return (
    <div className="delete-product-page-vandana">
      <div className="delete-toolbar-vandana">
        <div className="filters-vandana">
          {['All', 'Men', 'Women', 'Kids'].map((f) => (
            <button key={f} className={`chip-vandana ${filter === f ? 'active-vandana' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <div className="tools-vandana">
          <input
            className="search-input-vandana"
            placeholder="Search by product, design code, pattern type, category, colour, size or barcode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="sort-select-vandana" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Sub-categories</option>
            {categoryFilterOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <select className="sort-select-vandana" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="price_b2c_asc">Price B2C: Low to High</option>
            <option value="price_b2c_desc">Price B2C: High to Low</option>
            <option value="stock_desc">Stock: High to Low</option>
            <option value="brand_asc">Brand: A to Z</option>
          </select>

          <button className="refresh-btn-vandana" onClick={fetchAll} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>

          <button className="danger-btn-vandana" onClick={() => askDelete(selectedItems)}>
            Delete Selected
          </button>
        </div>
      </div>

      <div className="delete-section2-vandana">
        <h2>Product Table ({groupedRows.length})</h2>
        <div className="table-scroll-wrapper-vandana">
          <table className="table-vandana">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={toggleSelectAllVisible}
                    checked={
                      groupedRows.length > 0 &&
                      groupedRows.every((group) => group.currentItem && selectedMap[group.currentItem.variant_key])
                    }
                    aria-label="Select all visible"
                  />
                </th>
                <th>Sl. No</th>
                <th>Gender</th>
                <th>Sub-category</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Design Code</th>
                <th>Pattern Type</th>
                <th>Pattern Code</th>
                <th>Color</th>
                <th>Size</th>
                <th>Original Price (B2C)</th>
                <th>Discount % (B2C)</th>
                <th>Final Price (B2C)</th>
                <th>Stock</th>
                <th>Image</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {groupedRows.map((group, idx) => {
                const current = group.currentItem
                const isSelected = current && selectedMap[current.variant_key]

                return (
                  <tr key={group.group_key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(isSelected)}
                        onChange={() => toggleSelect(current)}
                        aria-label={`Select ${group.product_name}`}
                      />
                    </td>
                    <td>{idx + 1}</td>
                    <td>{group.category}</td>
                    <td>{group.category_path || [group.parent_category_name, group.category_name].filter(Boolean).join(' > ') || '-'}</td>
                    <td>{group.brand}</td>
                    <td>{group.product_name}</td>
                    <td>{group.design_code || '-'}</td>
                    <td>{group.pattern_type || '-'}</td>
                    <td>{group.pattern_code || '-'}</td>
                    <td>
                      <select
                        className="variant-select-vandana"
                        value={group.selectedColor}
                        onChange={(e) => handleColorChange(group, e.target.value)}
                      >
                        {group.colors.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="variant-select-vandana"
                        value={group.selectedSize}
                        onChange={(e) => handleSizeChange(group, e.target.value)}
                      >
                        {group.sizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{current?.original_price_b2c ?? 0}</td>
                    <td>{current?.discount_b2c ?? 0}</td>
                    <td>{computeFinal(current?.original_price_b2c, current?.discount_b2c).toFixed(2)}</td>
                    <td>{current?.total_count ?? 0}</td>
                    <td>
                      {current?.image_url ? (
                        <img src={current.image_url} alt="product" className="table-image-vandana" />
                      ) : (
                        <div className="table-image-placeholder-vandana">No Image</div>
                      )}
                    </td>
                    <td>
                      <button className="delete-btn-vandana" onClick={() => askDelete([current])}>
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}

              {!groupedRows.length && (
                <tr>
                  <td colSpan="17" className="empty-cell-vandana">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popupMessage && <div className={`popup-card-vandana ${popupType}`}>{popupMessage}</div>}

      {showConfirm && (
        <div className="popup-confirm-overlay-vandana">
          <div className="popup-confirm-box-vandana">
            <p className="confirm-title-vandana">
              {confirmItems.length > 1 ? `Delete ${confirmItems.length} selected variants?` : 'Delete this variant?'}
            </p>

            <div className="confirm-products-vandana">
              {confirmItems.map((item) => (
                <div className="confirm-product-card-vandana" key={item.variant_key}>
                  {item.image_url ? (
                    <img src={item.image_url} alt="product" className="confirm-image-vandana" />
                  ) : (
                    <div className="confirm-image-placeholder-vandana">No Image</div>
                  )}

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
                  </div>
                </div>
              ))}
            </div>

            <div className="popup-actions-vandana">
              <button onClick={() => confirmDelete(true)}>Yes, Delete</button>
              <button onClick={() => confirmDelete(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeleteProduct