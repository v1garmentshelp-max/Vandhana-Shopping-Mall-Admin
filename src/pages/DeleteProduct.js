import React, { useEffect, useMemo, useState } from 'react'
import './DeleteProduct.css'

const DEFAULT_API_BASE = 'https://taras-kart-backend.vercel.app'
const DEFAULT_ASSETS_BASE = 'https://taras-kart-backend.vercel.app/uploads'

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

const coerceNumber = (value) => {
  const number =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? '').trim())

  return Number.isFinite(number) ? number : 0
}

const cleanText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeKey = (value) =>
  cleanText(value).toLowerCase()

const hasGroupedVariantValue = (value) =>
  cleanText(value).includes(',')

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

  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

const withBranch = (url) => {
  const branchId = getBranchId()

  if (!branchId) return url

  return `${url}${url.includes('?') ? '&' : '?'}branch_id=${encodeURIComponent(
    branchId
  )}`
}

const normalizeAssetUrl = (value) => {
  if (!value) return ''

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  const base = ASSETS_BASE || API_BASE
  const needsSlash = !String(value).startsWith('/')

  return `${base}${needsSlash ? '/' : ''}${value}`
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

const uniqueValues = (values) => {
  const map = new Map()

  for (const value of values || []) {
    const text = cleanText(value)

    if (!text) continue

    const key = normalizeKey(text)

    if (!map.has(key)) {
      map.set(key, text)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = parseFloat(
      String(a).replace(/[^\d.]/g, '')
    )

    const nb = parseFloat(
      String(b).replace(/[^\d.]/g, '')
    )

    if (
      Number.isFinite(na) &&
      Number.isFinite(nb) &&
      na !== nb
    ) {
      return na - nb
    }

    return String(a).localeCompare(
      String(b),
      undefined,
      { numeric: true }
    )
  })
}

const mapVariantRow = (product, variant) => {
  const productId =
    product.product_id ??
    product.id ??
    variant.product_id ??
    ''

  const variantId =
    variant.variant_id ??
    variant.id ??
    ''

  const color = cleanText(
    variant.color ||
      variant.colour
  )

  const size = cleanText(
    variant.size
  )

  if (!variantId || !color || !size) {
    return null
  }

  if (
    hasGroupedVariantValue(color) ||
    hasGroupedVariantValue(size)
  ) {
    return null
  }

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
    category: cleanText(
      product.category ||
        product.gender
    ),
    category_id:
      product.category_id ??
      variant.category_id ??
      '',
    category_name: cleanText(
      product.category_name ||
        variant.category_name
    ),
    category_slug: cleanText(
      product.category_slug ||
        variant.category_slug
    ),
    parent_category_name: cleanText(
      product.parent_category_name ||
        variant.parent_category_name
    ),
    category_path: cleanText(
      product.category_path ||
        variant.category_path
    ),
    brand: cleanText(
      product.brand ||
        product.brand_name
    ),
    product_name: cleanText(
      product.product_name ||
        product.name
    ),
    design_code: cleanText(
      product.design_code ||
        product.designCode ||
        variant.design_code ||
        variant.designCode
    ),
    pattern_type: cleanText(
      product.pattern_type ||
        product.patternType ||
        variant.pattern_type ||
        variant.patternType
    ),
    pattern_code: cleanText(
      product.pattern_code ||
        product.patternCode ||
        variant.pattern_code ||
        variant.patternCode
    ),
    color,
    colour: color,
    size,
    barcode: cleanText(
      variant.barcode ||
        variant.ean_code
    ),
    original_price_b2b:
      coerceNumber(originalPriceB2b),
    discount_b2b:
      coerceNumber(discountB2b),
    final_price_b2b:
      coerceNumber(
        variant.final_price_b2b ??
          product.final_price_b2b
      ),
    original_price_b2c:
      coerceNumber(originalPriceB2c),
    discount_b2c:
      coerceNumber(discountB2c),
    final_price_b2c:
      coerceNumber(
        variant.final_price_b2c ??
          product.final_price_b2c
      ),
    total_count:
      coerceNumber(
        variant.on_hand ??
          variant.total_count ??
          variant.stock ??
          variant.quantity ??
          variant.available_qty ??
          0
      ),
    reserved_count:
      coerceNumber(
        variant.reserved ??
          variant.reserved_count ??
          product.reserved ??
          0
      ),
    available_qty:
      coerceNumber(
        variant.available_qty ??
          variant.on_hand ??
          variant.total_count ??
          0
      ),
    image_url: normalizeAssetUrl(
      variant.shared_image_url ||
        variant.image_url ||
        product.shared_image_url ||
        product.image_url ||
        product.image ||
        product.imageUrl ||
        product.path ||
        ''
    )
  }

  return {
    ...mapped,
    group_key: makeGroupKey(mapped),
    variant_key: makeVariantKey(mapped)
  }
}

const mapSingleRow = (product) => {
  const productId =
    product.product_id ??
    product.id ??
    product._id ??
    product.uuid ??
    ''

  const variantId =
    product.variant_id ??
    product.primary_variant_id ??
    product.id ??
    ''

  const color = cleanText(
    product.color ||
      product.colour
  )

  const size = cleanText(
    product.size
  )

  if (!variantId || !color || !size) {
    return null
  }

  if (
    hasGroupedVariantValue(color) ||
    hasGroupedVariantValue(size)
  ) {
    return null
  }

  const mapped = {
    id: variantId,
    variant_id: variantId,
    product_id: productId,
    category: cleanText(
      product.category ||
        product.gender
    ),
    category_id:
      product.category_id || '',
    category_name: cleanText(
      product.category_name
    ),
    category_slug: cleanText(
      product.category_slug
    ),
    parent_category_name: cleanText(
      product.parent_category_name
    ),
    category_path: cleanText(
      product.category_path
    ),
    brand: cleanText(
      product.brand ||
        product.brand_name
    ),
    product_name: cleanText(
      product.product_name ||
        product.name
    ),
    design_code: cleanText(
      product.design_code ||
        product.designCode
    ),
    pattern_type: cleanText(
      product.pattern_type ||
        product.patternType
    ),
    pattern_code: cleanText(
      product.pattern_code ||
        product.patternCode
    ),
    color,
    colour: color,
    size,
    barcode: cleanText(
      product.barcode ||
        product.ean_code
    ),
    original_price_b2b:
      coerceNumber(
        product.original_price_b2b
      ),
    discount_b2b:
      coerceNumber(
        product.discount_b2b ||
          product.b2b_discount_pct
      ),
    final_price_b2b:
      coerceNumber(
        product.final_price_b2b
      ),
    original_price_b2c:
      coerceNumber(
        product.original_price_b2c ||
          product.mrp
      ),
    discount_b2c:
      coerceNumber(
        product.discount_b2c ||
          product.b2c_discount_pct
      ),
    final_price_b2c:
      coerceNumber(
        product.final_price_b2c
      ),
    total_count:
      coerceNumber(
        product.on_hand ??
          product.total_count ??
          product.stock ??
          product.quantity ??
          product.available_qty ??
          0
      ),
    reserved_count:
      coerceNumber(
        product.reserved ??
          product.reserved_count ??
          0
      ),
    available_qty:
      coerceNumber(
        product.available_qty ??
          product.on_hand ??
          product.total_count ??
          0
      ),
    image_url: normalizeAssetUrl(
      product.shared_image_url ||
        product.image_url ||
        product.image ||
        product.imageUrl ||
        product.path ||
        ''
    )
  }

  return {
    ...mapped,
    group_key: makeGroupKey(mapped),
    variant_key: makeVariantKey(mapped)
  }
}

const flattenProducts = (items) => {
  const output = []

  for (const product of Array.isArray(items) ? items : []) {
    const variants =
      Array.isArray(product.variants)
        ? product.variants
        : []

    if (variants.length) {
      for (const variant of variants) {
        const mapped =
          mapVariantRow(
            product,
            variant
          )

        if (mapped) {
          output.push(mapped)
        }
      }
    } else {
      const mapped =
        mapSingleRow(product)

      if (mapped) {
        output.push(mapped)
      }
    }
  }

  const seen = new Set()

  return output.filter((item) => {
    if (
      seen.has(
        item.variant_key
      )
    ) {
      return false
    }

    seen.add(
      item.variant_key
    )

    return true
  })
}

const getItemsFromResponse = (data) => {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.products)) {
    return data.products
  }

  if (Array.isArray(data?.data)) {
    return data.data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.rows)) {
    return data.rows
  }

  if (Array.isArray(data?.result)) {
    return data.result
  }

  return []
}

const fetchJson = async (url) => {
  const response =
    await fetch(url, {
      headers:
        getAuthHeaders(),
      credentials: 'omit',
      mode: 'cors'
    })

  if (!response.ok) {
    throw new Error(
      'Request failed'
    )
  }

  return response.json()
}

const fetchAllProducts = async () => {
  const urls = [
    withBranch(
      `${API_BASE}/api/products?all=true&limit=50000`
    ),
    withBranch(
      `${API_BASE}/api/products?category=all&page=1&limit=50000`
    ),
    withBranch(
      `${API_BASE}/api/products?limit=50000`
    ),
    withBranch(
      `${API_BASE}/api/products`
    )
  ]

  for (const url of urls) {
    try {
      const data =
        await fetchJson(url)

      const products =
        getItemsFromResponse(
          data
        )

      const rows =
        flattenProducts(
          products
        )

      if (rows.length) {
        return rows
      }
    } catch {}
  }

  return []
}

const deleteVariantRequest = async (item) => {
  const variantId =
    item?.variant_id ||
    item?.id

  if (!variantId) {
    throw new Error(
      'Variant id missing'
    )
  }

  const query =
    new URLSearchParams()

  const branchId =
    getBranchId()

  if (branchId) {
    query.set(
      'branch_id',
      branchId
    )
  }

  const suffix =
    query.toString()
      ? `?${query.toString()}`
      : ''

  const response =
    await fetch(
      `${API_BASE}/api/products/${encodeURIComponent(
        variantId
      )}${suffix}`,
      {
        method: 'DELETE',
        headers:
          getAuthHeaders(),
        credentials: 'omit',
        mode: 'cors'
      }
    )

  if (!response.ok) {
    let message =
      'Variant delete failed'

    try {
      const data =
        await response.json()

      message =
        data?.message ||
        message
    } catch {}

    throw new Error(
      message
    )
  }

  return true
}

const selectedValuesFor = (
  choices,
  field,
  options
) => {
  if (!options.length) {
    return []
  }

  if (options.length === 1) {
    return [...options]
  }

  if (
    !choices ||
    !Object.prototype.hasOwnProperty.call(
      choices,
      field
    )
  ) {
    return [...options]
  }

  const values =
    Array.isArray(
      choices[field]
    )
      ? choices[field]
      : []

  return values.filter(
    (selected) =>
      options.some(
        (option) =>
          normalizeKey(
            option
          ) ===
          normalizeKey(
            selected
          )
      )
  )
}

const isValueSelected = (
  selected,
  value
) =>
  selected.some(
    (item) =>
      normalizeKey(item) ===
      normalizeKey(value)
  )

const matchesSelectedDimension = (
  value,
  selected,
  options
) => {
  if (!options.length) {
    return true
  }

  if (!selected.length) {
    return false
  }

  return isValueSelected(
    selected,
    value
  )
}

const getUniformNumber = (
  variants,
  field,
  decimals = 2
) => {
  const values =
    uniqueValues(
      variants.map(
        (variant) =>
          coerceNumber(
            variant[field]
          ).toFixed(decimals)
      )
    )

  if (!values.length) {
    return Number(0).toFixed(
      decimals
    )
  }

  if (values.length === 1) {
    return Number(
      values[0]
    ).toFixed(
      decimals
    )
  }

  return 'Mixed'
}

const sumField = (
  variants,
  field
) =>
  variants.reduce(
    (total, variant) =>
      total +
      coerceNumber(
        variant[field]
      ),
    0
  )

const getFinalPriceDisplay = (
  variants
) => {
  const values =
    uniqueValues(
      variants.map(
        (variant) =>
          computeFinal(
            variant.original_price_b2c,
            variant.discount_b2c
          ).toFixed(2)
      )
    )

  if (!values.length) {
    return '0.00'
  }

  if (values.length === 1) {
    return Number(
      values[0]
    ).toFixed(2)
  }

  return 'Mixed'
}

const DropdownCell = ({
  title,
  options,
  selected,
  onToggle,
  onToggleAll
}) => {
  if (!options.length) {
    return <span>-</span>
  }

  if (options.length === 1) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '5px 10px',
          borderRadius: 18,
          border:
            '1px solid #ead18b',
          background:
            '#fff8df',
          color:
            '#6f5100',
          fontWeight: 700,
          fontSize: 13
        }}
      >
        {options[0]}
      </span>
    )
  }

  const allSelected =
    selected.length ===
    options.length

  const summary =
    allSelected
      ? `All (${options.length})`
      : selected.length
        ? `${selected.length} selected`
        : `Select ${title}`

  return (
    <details
      style={{
        position:
          'relative',
        minWidth: 150
      }}
    >
      <summary
        style={{
          cursor:
            'pointer',
          listStyle:
            'none',
          padding:
            '8px 12px',
          border:
            '1px solid #e5c96f',
          borderRadius: 8,
          background:
            '#fff8df',
          color:
            '#684d00',
          fontWeight: 700,
          fontSize: 13,
          userSelect:
            'none',
          whiteSpace:
            'nowrap'
        }}
      >
        {summary} ▾
      </summary>

      <div
        style={{
          position:
            'absolute',
          zIndex: 1000,
          top:
            'calc(100% + 5px)',
          left: 0,
          minWidth: 210,
          maxWidth: 300,
          maxHeight: 320,
          overflowY:
            'auto',
          background:
            '#ffffff',
          border:
            '1px solid #e2c15d',
          borderRadius: 10,
          boxShadow:
            '0 10px 28px rgba(0,0,0,0.18)',
          padding: 8
        }}
      >
        <label
          style={{
            display:
              'flex',
            alignItems:
              'center',
            gap: 9,
            padding:
              '9px 10px',
            cursor:
              'pointer',
            fontWeight: 800,
            color:
              '#111',
            borderBottom:
              '1px solid #eee'
          }}
        >
          <input
            type="checkbox"
            checked={
              allSelected
            }
            onChange={
              onToggleAll
            }
          />

          <span>
            All
          </span>
        </label>

        {options.map(
          (option) => {
            const checked =
              isValueSelected(
                selected,
                option
              )

            return (
              <label
                key={
                  option
                }
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: 9,
                  padding:
                    '8px 10px',
                  cursor:
                    'pointer',
                  color:
                    '#222'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    checked
                  }
                  onChange={() =>
                    onToggle(
                      option
                    )
                  }
                />

                <span>
                  {option}
                </span>
              </label>
            )
          }
        )}
      </div>
    </details>
  )
}

const DeleteProduct = () => {
  const [
    rows,
    setRows
  ] = useState([])

  const [
    filter,
    setFilter
  ] = useState('All')

  const [
    categoryFilter,
    setCategoryFilter
  ] = useState('All')

  const [
    search,
    setSearch
  ] = useState('')

  const [
    sortBy,
    setSortBy
  ] = useState('recent')

  const [
    isLoading,
    setIsLoading
  ] = useState(false)

  const [
    popupMessage,
    setPopupMessage
  ] = useState('')

  const [
    popupType,
    setPopupType
  ] = useState('')

  const [
    confirmItems,
    setConfirmItems
  ] = useState([])

  const [
    showConfirm,
    setShowConfirm
  ] = useState(false)

  const [
    selectedMap,
    setSelectedMap
  ] = useState({})

  const [
    variantChoices,
    setVariantChoices
  ] = useState({})

  const showPopup = (
    message,
    type = 'success',
    time = 2200
  ) => {
    setPopupMessage(
      message
    )

    setPopupType(
      type
    )

    setTimeout(
      () =>
        setPopupMessage(
          ''
        ),
      time
    )
  }

  const fetchAll =
    async () => {
      setIsLoading(true)

      try {
        const allRows =
          await fetchAllProducts()

        setRows(
          allRows
        )

        setSelectedMap(
          {}
        )

        setVariantChoices(
          {}
        )
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

  const categoryFilterOptions =
    useMemo(() => {
      const list =
        rows
          .filter(
            (row) => {
              if (
                filter ===
                'Men'
              ) {
                return (
                  row.category.toLowerCase() ===
                  'men'
                )
              }

              if (
                filter ===
                'Women'
              ) {
                return (
                  row.category.toLowerCase() ===
                  'women'
                )
              }

              if (
                filter ===
                'Kids'
              ) {
                return row.category
                  .toLowerCase()
                  .startsWith(
                    'kids'
                  )
              }

              return true
            }
          )
          .map(
            (row) => ({
              id: String(
                row.category_id ||
                  ''
              ),
              label:
                row.category_path ||
                [
                  row.parent_category_name,
                  row.category_name
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ' > '
                  ) ||
                row.category_name
            })
          )
          .filter(
            (item) =>
              item.id &&
              item.label
          )

      const seen =
        new Set()

      return list.filter(
        (item) => {
          if (
            seen.has(
              item.id
            )
          ) {
            return false
          }

          seen.add(
            item.id
          )

          return true
        }
      )
    }, [rows, filter])

  useEffect(() => {
    setCategoryFilter(
      'All'
    )
  }, [filter])

  const filteredSortedRows =
    useMemo(() => {
      let list = rows

      if (
        filter === 'Men'
      ) {
        list =
          list.filter(
            (row) =>
              row.category.toLowerCase() ===
              'men'
          )
      } else if (
        filter === 'Women'
      ) {
        list =
          list.filter(
            (row) =>
              row.category.toLowerCase() ===
              'women'
          )
      } else if (
        filter === 'Kids'
      ) {
        list =
          list.filter(
            (row) =>
              row.category
                .toLowerCase()
                .startsWith(
                  'kids'
                )
          )
      }

      if (
        categoryFilter !==
        'All'
      ) {
        list =
          list.filter(
            (row) =>
              String(
                row.category_id ||
                  ''
              ) ===
              String(
                categoryFilter
              )
          )
      }

      if (
        search.trim()
      ) {
        const query =
          search
            .trim()
            .toLowerCase()

        list =
          list.filter(
            (row) =>
              (
                row.brand ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.product_name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.design_code ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.pattern_type ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.pattern_code ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.color ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.size ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.barcode ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.category ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.category_name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.parent_category_name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              (
                row.category_path ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                )
          )
      }

      const sorted =
        [...list]

      if (
        sortBy ===
        'recent'
      ) {
        sorted.sort(
          (a, b) => {
            const av =
              Number(
                a.product_id ||
                  a.id
              ) || 0

            const bv =
              Number(
                b.product_id ||
                  b.id
              ) || 0

            if (
              bv !== av
            ) {
              return bv - av
            }

            return (
              (Number(
                b.variant_id
              ) || 0) -
              (Number(
                a.variant_id
              ) || 0)
            )
          }
        )
      } else if (
        sortBy ===
        'price_b2c_asc'
      ) {
        sorted.sort(
          (a, b) =>
            computeFinal(
              a.original_price_b2c,
              a.discount_b2c
            ) -
            computeFinal(
              b.original_price_b2c,
              b.discount_b2c
            )
        )
      } else if (
        sortBy ===
        'price_b2c_desc'
      ) {
        sorted.sort(
          (a, b) =>
            computeFinal(
              b.original_price_b2c,
              b.discount_b2c
            ) -
            computeFinal(
              a.original_price_b2c,
              a.discount_b2c
            )
        )
      } else if (
        sortBy ===
        'stock_desc'
      ) {
        sorted.sort(
          (a, b) =>
            coerceNumber(
              b.total_count
            ) -
            coerceNumber(
              a.total_count
            )
        )
      } else if (
        sortBy ===
        'brand_asc'
      ) {
        sorted.sort(
          (a, b) =>
            String(
              a.brand ||
                ''
            ).localeCompare(
              String(
                b.brand ||
                  ''
              )
            )
        )
      }

      return sorted
    }, [
      rows,
      filter,
      categoryFilter,
      search,
      sortBy
    ])

  const groupedRows =
    useMemo(() => {
      const groupMap =
        new Map()

      for (
        const row of
        filteredSortedRows
      ) {
        const key =
          row.group_key

        if (
          !groupMap.has(
            key
          )
        ) {
          groupMap.set(
            key,
            {
              group_key:
                key,
              product_id:
                row.product_id,
              category:
                row.category,
              category_id:
                row.category_id,
              category_name:
                row.category_name,
              parent_category_name:
                row.parent_category_name,
              category_path:
                row.category_path,
              brand:
                row.brand,
              product_name:
                row.product_name,
              variants: []
            }
          )
        }

        const group =
          groupMap.get(
            key
          )

        if (
          !group.variants.some(
            (variant) =>
              variant.variant_key ===
              row.variant_key
          )
        ) {
          group.variants.push(
            row
          )
        }
      }

      return Array.from(
        groupMap.values()
      ).map(
        (group) => {
          const designCodes =
            uniqueValues(
              group.variants.map(
                (variant) =>
                  variant.design_code
              )
            )

          const patternTypes =
            uniqueValues(
              group.variants.map(
                (variant) =>
                  variant.pattern_type
              )
            )

          const patternCodes =
            uniqueValues(
              group.variants.map(
                (variant) =>
                  variant.pattern_code
              )
            )

          const colors =
            uniqueValues(
              group.variants.map(
                (variant) =>
                  variant.color
              )
            )

          const sizes =
            uniqueValues(
              group.variants.map(
                (variant) =>
                  variant.size
              )
            )

          const choice =
            variantChoices[
              group.group_key
            ] || {}

          const selectedDesignCodes =
            selectedValuesFor(
              choice,
              'designCodes',
              designCodes
            )

          const selectedPatternTypes =
            selectedValuesFor(
              choice,
              'patternTypes',
              patternTypes
            )

          const selectedPatternCodes =
            selectedValuesFor(
              choice,
              'patternCodes',
              patternCodes
            )

          const selectedColors =
            selectedValuesFor(
              choice,
              'colors',
              colors
            )

          const selectedSizes =
            selectedValuesFor(
              choice,
              'sizes',
              sizes
            )

          const matchingVariants =
            group.variants.filter(
              (variant) =>
                matchesSelectedDimension(
                  variant.design_code,
                  selectedDesignCodes,
                  designCodes
                ) &&
                matchesSelectedDimension(
                  variant.pattern_type,
                  selectedPatternTypes,
                  patternTypes
                ) &&
                matchesSelectedDimension(
                  variant.pattern_code,
                  selectedPatternCodes,
                  patternCodes
                ) &&
                matchesSelectedDimension(
                  variant.color,
                  selectedColors,
                  colors
                ) &&
                matchesSelectedDimension(
                  variant.size,
                  selectedSizes,
                  sizes
                )
            )

          const displayVariants =
            matchingVariants.length
              ? matchingVariants
              : group.variants

          const images =
            uniqueValues(
              displayVariants
                .map(
                  (variant) =>
                    variant.image_url
                )
                .filter(
                  Boolean
                )
            )

          return {
            ...group,
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
            image_url:
              images[0] ||
              '',
            different_images:
              images.length,
            original_price_display:
              getUniformNumber(
                displayVariants,
                'original_price_b2c'
              ),
            discount_display:
              getUniformNumber(
                displayVariants,
                'discount_b2c'
              ),
            final_price_display:
              getFinalPriceDisplay(
                displayVariants
              ),
            stock_display:
              sumField(
                displayVariants,
                'total_count'
              ),
            reserved_display:
              sumField(
                displayVariants,
                'reserved_count'
              )
          }
        }
      )
    }, [
      filteredSortedRows,
      variantChoices
    ])

  const selectedItems =
    useMemo(
      () =>
        Object.values(
          selectedMap
        ),
      [selectedMap]
    )

  const removeSelectionsForGroup =
    (groupKey) => {
      setSelectedMap(
        (previous) => {
          const next =
            {}

          for (
            const [
              key,
              value
            ] of Object.entries(
              previous
            )
          ) {
            if (
              value.group_key !==
              groupKey
            ) {
              next[key] =
                value
            }
          }

          return next
        }
      )
    }

  const updateDimension = (
    group,
    field,
    options,
    value
  ) => {
    setVariantChoices(
      (previous) => {
        const currentChoice =
          previous[
            group.group_key
          ] || {}

        const currentValues =
          selectedValuesFor(
            currentChoice,
            field,
            options
          )

        let nextValues

        if (
          isValueSelected(
            currentValues,
            value
          )
        ) {
          nextValues =
            currentValues.filter(
              (item) =>
                normalizeKey(
                  item
                ) !==
                normalizeKey(
                  value
                )
            )
        } else {
          nextValues =
            uniqueValues([
              ...currentValues,
              value
            ])
        }

        return {
          ...previous,
          [group.group_key]:
            {
              ...currentChoice,
              [field]:
                nextValues
            }
        }
      }
    )

    removeSelectionsForGroup(
      group.group_key
    )
  }

  const toggleAllDimension = (
    group,
    field,
    options
  ) => {
    setVariantChoices(
      (previous) => {
        const currentChoice =
          previous[
            group.group_key
          ] || {}

        const currentValues =
          selectedValuesFor(
            currentChoice,
            field,
            options
          )

        const allSelected =
          currentValues.length ===
          options.length

        return {
          ...previous,
          [group.group_key]:
            {
              ...currentChoice,
              [field]:
                allSelected
                  ? []
                  : [...options]
            }
        }
      }
    )

    removeSelectionsForGroup(
      group.group_key
    )
  }

  const askDelete = (
    items
  ) => {
    const dedupe =
      new Map()

    for (
      const item of
      Array.isArray(items)
        ? items
        : []
    ) {
      if (
        !item ||
        !item.variant_id
      ) {
        continue
      }

      dedupe.set(
        item.variant_key,
        item
      )
    }

    const validItems =
      Array.from(
        dedupe.values()
      )

    if (
      !validItems.length
    ) {
      showPopup(
        'Select at least one colour and size',
        'error',
        2600
      )

      return
    }

    setConfirmItems(
      validItems
    )

    setShowConfirm(
      true
    )
  }

  const confirmDelete =
    async (confirmed) => {
      setShowConfirm(
        false
      )

      if (!confirmed) {
        setConfirmItems(
          []
        )

        return
      }

      if (
        !confirmItems.length
      ) {
        return
      }

      const results =
        await Promise.allSettled(
          confirmItems.map(
            (item) =>
              deleteVariantRequest(
                item
              )
          )
        )

      const deletedItems =
        []

      const failedItems =
        []

      results.forEach(
        (result, index) => {
          if (
            result.status ===
            'fulfilled'
          ) {
            deletedItems.push(
              confirmItems[
                index
              ]
            )
          } else {
            failedItems.push(
              {
                item:
                  confirmItems[
                    index
                  ],
                error:
                  result.reason
              }
            )
          }
        }
      )

      if (
        deletedItems.length
      ) {
        const deletedKeys =
          new Set(
            deletedItems.map(
              (item) =>
                item.variant_key
            )
          )

        setRows(
          (previous) =>
            previous.filter(
              (row) =>
                !deletedKeys.has(
                  row.variant_key
                )
            )
        )

        setSelectedMap(
          (previous) => {
            const next = {
              ...previous
            }

            for (
              const item of
              deletedItems
            ) {
              delete next[
                item.variant_key
              ]
            }

            return next
          }
        )
      }

      if (
        deletedItems.length &&
        !failedItems.length
      ) {
        showPopup(
          deletedItems.length ===
            1
            ? 'Variant deleted successfully'
            : `${deletedItems.length} variants deleted successfully`,
          'success',
          2600
        )
      } else if (
        deletedItems.length &&
        failedItems.length
      ) {
        showPopup(
          `Deleted ${deletedItems.length}. Failed ${failedItems.length}.`,
          'error',
          3200
        )
      } else {
        showPopup(
          failedItems[0]
            ?.error
            ?.message ||
            'Delete failed',
          'error',
          3000
        )
      }

      setConfirmItems(
        []
      )
    }

  const toggleGroupSelection =
    (group) => {
      const variants =
        group.matchingVariants

      if (
        !variants.length
      ) {
        showPopup(
          'Select at least one colour and size',
          'error',
          2400
        )

        return
      }

      const allSelected =
        variants.every(
          (variant) =>
            Boolean(
              selectedMap[
                variant.variant_key
              ]
            )
        )

      setSelectedMap(
        (previous) => {
          const next = {
            ...previous
          }

          if (
            allSelected
          ) {
            for (
              const variant of
              variants
            ) {
              delete next[
                variant.variant_key
              ]
            }
          } else {
            for (
              const variant of
              variants
            ) {
              next[
                variant.variant_key
              ] = variant
            }
          }

          return next
        }
      )
    }

  const allVisibleVariants =
    useMemo(
      () => {
        const map =
          new Map()

        for (
          const group of
          groupedRows
        ) {
          for (
            const variant of
            group.matchingVariants
          ) {
            map.set(
              variant.variant_key,
              variant
            )
          }
        }

        return Array.from(
          map.values()
        )
      },
      [groupedRows]
    )

  const allVisibleSelected =
    allVisibleVariants.length >
      0 &&
    allVisibleVariants.every(
      (variant) =>
        Boolean(
          selectedMap[
            variant.variant_key
          ]
        )
    )

  const toggleSelectAllVisible =
    () => {
      if (
        !allVisibleVariants.length
      ) {
        return
      }

      setSelectedMap(
        (previous) => {
          const next = {
            ...previous
          }

          if (
            allVisibleSelected
          ) {
            for (
              const variant of
              allVisibleVariants
            ) {
              delete next[
                variant.variant_key
              ]
            }
          } else {
            for (
              const variant of
              allVisibleVariants
            ) {
              next[
                variant.variant_key
              ] = variant
            }
          }

          return next
        }
      )
    }

  return (
    <div className="delete-product-page-vandana">
      <div className="delete-toolbar-vandana">
        <div className="filters-vandana">
          {[
            'All',
            'Men',
            'Women',
            'Kids'
          ].map(
            (item) => (
              <button
                key={
                  item
                }
                className={`chip-vandana ${
                  filter ===
                  item
                    ? 'active-vandana'
                    : ''
                }`}
                onClick={() =>
                  setFilter(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}
        </div>

        <div className="tools-vandana">
          <input
            className="search-input-vandana"
            placeholder="Search by product, design code, pattern type, category, colour, size or barcode"
            value={
              search
            }
            onChange={
              (event) =>
                setSearch(
                  event
                    .target
                    .value
                )
            }
          />

          <select
            className="sort-select-vandana"
            value={
              categoryFilter
            }
            onChange={
              (event) =>
                setCategoryFilter(
                  event
                    .target
                    .value
                )
            }
          >
            <option value="All">
              All Sub-categories
            </option>

            {categoryFilterOptions.map(
              (item) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.label
                  }
                </option>
              )
            )}
          </select>

          <select
            className="sort-select-vandana"
            value={
              sortBy
            }
            onChange={
              (event) =>
                setSortBy(
                  event
                    .target
                    .value
                )
            }
          >
            <option value="recent">
              Sort: Recent
            </option>

            <option value="price_b2c_asc">
              Price B2C: Low to High
            </option>

            <option value="price_b2c_desc">
              Price B2C: High to Low
            </option>

            <option value="stock_desc">
              Stock: High to Low
            </option>

            <option value="brand_asc">
              Brand: A to Z
            </option>
          </select>

          <button
            className="refresh-btn-vandana"
            onClick={
              fetchAll
            }
            disabled={
              isLoading
            }
          >
            {isLoading
              ? 'Loading...'
              : 'Refresh'}
          </button>

          <button
            className="danger-btn-vandana"
            onClick={() =>
              askDelete(
                selectedItems
              )
            }
          >
            Delete Selected
            {selectedItems.length
              ? ` (${selectedItems.length})`
              : ''}
          </button>
        </div>
      </div>

      <div className="delete-section2-vandana">
        <h2>
          Product Table (
          {groupedRows.length}
          )
        </h2>

        <div className="table-scroll-wrapper-vandana">
          <table className="table-vandana">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      allVisibleSelected
                    }
                    onChange={
                      toggleSelectAllVisible
                    }
                    disabled={
                      !allVisibleVariants.length
                    }
                    aria-label="Select all visible variants"
                  />
                </th>

                <th>
                  Sl. No
                </th>

                <th>
                  Gender
                </th>

                <th>
                  Sub-category
                </th>

                <th>
                  Brand
                </th>

                <th>
                  Product Name
                </th>

                <th>
                  Design Code
                </th>

                <th>
                  Pattern Type
                </th>

                <th>
                  Pattern Code
                </th>

                <th>
                  Colors
                </th>

                <th>
                  Sizes
                </th>

                <th>
                  Original Price
                </th>

                <th>
                  Discount %
                </th>

                <th>
                  Final Price
                </th>

                <th>
                  Stock
                </th>

                <th>
                  Reserved
                </th>

                <th>
                  Image
                </th>

                <th>
                  Delete
                </th>
              </tr>
            </thead>

            <tbody>
              {groupedRows.map(
                (
                  group,
                  index
                ) => {
                  const groupAllSelected =
                    group
                      .matchingVariants
                      .length >
                      0 &&
                    group
                      .matchingVariants
                      .every(
                        (
                          variant
                        ) =>
                          Boolean(
                            selectedMap[
                              variant
                                .variant_key
                            ]
                          )
                      )

                  return (
                    <tr
                      key={
                        group.group_key
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={
                            groupAllSelected
                          }
                          disabled={
                            !group
                              .matchingVariants
                              .length
                          }
                          onChange={() =>
                            toggleGroupSelection(
                              group
                            )
                          }
                          aria-label={`Select ${group.product_name}`}
                        />
                      </td>

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        {group.category ||
                          '-'}
                      </td>

                      <td>
                        {group.category_path ||
                          [
                            group.parent_category_name,
                            group.category_name
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ' > '
                            ) ||
                          '-'}
                      </td>

                      <td>
                        {group.brand ||
                          '-'}
                      </td>

                      <td>
                        <div
                          style={{
                            fontWeight: 800
                          }}
                        >
                          {
                            group.product_name
                          }
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.65,
                            marginTop: 4
                          }}
                        >
                          Product ID:{' '}
                          {
                            group.product_id
                          }
                        </div>
                      </td>

                      <td>
                        <DropdownCell
                          title="design"
                          options={
                            group.designCodes
                          }
                          selected={
                            group.selectedDesignCodes
                          }
                          onToggle={(
                            value
                          ) =>
                            updateDimension(
                              group,
                              'designCodes',
                              group.designCodes,
                              value
                            )
                          }
                          onToggleAll={() =>
                            toggleAllDimension(
                              group,
                              'designCodes',
                              group.designCodes
                            )
                          }
                        />
                      </td>

                      <td>
                        <DropdownCell
                          title="pattern"
                          options={
                            group.patternTypes
                          }
                          selected={
                            group.selectedPatternTypes
                          }
                          onToggle={(
                            value
                          ) =>
                            updateDimension(
                              group,
                              'patternTypes',
                              group.patternTypes,
                              value
                            )
                          }
                          onToggleAll={() =>
                            toggleAllDimension(
                              group,
                              'patternTypes',
                              group.patternTypes
                            )
                          }
                        />
                      </td>

                      <td>
                        <DropdownCell
                          title="pattern code"
                          options={
                            group.patternCodes
                          }
                          selected={
                            group.selectedPatternCodes
                          }
                          onToggle={(
                            value
                          ) =>
                            updateDimension(
                              group,
                              'patternCodes',
                              group.patternCodes,
                              value
                            )
                          }
                          onToggleAll={() =>
                            toggleAllDimension(
                              group,
                              'patternCodes',
                              group.patternCodes
                            )
                          }
                        />
                      </td>

                      <td>
                        <DropdownCell
                          title="colors"
                          options={
                            group.colors
                          }
                          selected={
                            group.selectedColors
                          }
                          onToggle={(
                            value
                          ) =>
                            updateDimension(
                              group,
                              'colors',
                              group.colors,
                              value
                            )
                          }
                          onToggleAll={() =>
                            toggleAllDimension(
                              group,
                              'colors',
                              group.colors
                            )
                          }
                        />
                      </td>

                      <td>
                        <DropdownCell
                          title="sizes"
                          options={
                            group.sizes
                          }
                          selected={
                            group.selectedSizes
                          }
                          onToggle={(
                            value
                          ) =>
                            updateDimension(
                              group,
                              'sizes',
                              group.sizes,
                              value
                            )
                          }
                          onToggleAll={() =>
                            toggleAllDimension(
                              group,
                              'sizes',
                              group.sizes
                            )
                          }
                        />
                      </td>

                      <td>
                        {
                          group.original_price_display
                        }
                      </td>

                      <td>
                        {
                          group.discount_display
                        }
                      </td>

                      <td>
                        {
                          group.final_price_display
                        }
                      </td>

                      <td>
                        {
                          group.stock_display
                        }
                      </td>

                      <td>
                        {
                          group.reserved_display
                        }
                      </td>

                      <td>
                        {group.image_url ? (
                          <div
                            style={{
                              display:
                                'flex',
                              alignItems:
                                'center',
                              gap: 6
                            }}
                          >
                            <img
                              src={
                                group.image_url
                              }
                              alt={
                                group.product_name
                              }
                              className="table-image-vandana"
                            />

                            {group.different_images >
                              1 && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700
                                }}
                              >
                                +
                                {group.different_images -
                                  1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="table-image-placeholder-vandana">
                            No Image
                          </div>
                        )}
                      </td>

                      <td>
                        <button
                          className="delete-btn-vandana"
                          disabled={
                            !group
                              .matchingVariants
                              .length
                          }
                          onClick={() =>
                            askDelete(
                              group.matchingVariants
                            )
                          }
                        >
                          Delete
                          {group
                            .matchingVariants
                            .length >
                            1
                            ? ` (${group.matchingVariants.length})`
                            : ''}
                        </button>
                      </td>
                    </tr>
                  )
                }
              )}

              {!groupedRows.length && (
                <tr>
                  <td
                    colSpan="18"
                    className="empty-cell-vandana"
                  >
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popupMessage && (
        <div
          className={`popup-card-vandana ${popupType}`}
        >
          {popupMessage}
        </div>
      )}

      {showConfirm && (
        <div className="popup-confirm-overlay-vandana">
          <div className="popup-confirm-box-vandana">
            <p className="confirm-title-vandana">
              {confirmItems.length >
              1
                ? `Delete ${confirmItems.length} selected variants?`
                : 'Delete this variant?'}
            </p>

            <div
              style={{
                marginBottom: 14,
                padding:
                  '10px 14px',
                borderRadius: 8,
                background:
                  '#fff3cd',
                color:
                  '#664d03',
                fontWeight: 700
              }}
            >
              {confirmItems.length}{' '}
              variant
              {confirmItems.length ===
              1
                ? ''
                : 's'}{' '}
              will be deleted.
            </div>

            <div className="confirm-products-vandana">
              {confirmItems.map(
                (item) => (
                  <div
                    className="confirm-product-card-vandana"
                    key={
                      item.variant_key
                    }
                  >
                    {item.image_url ? (
                      <img
                        src={
                          item.image_url
                        }
                        alt={
                          item.product_name
                        }
                        className="confirm-image-vandana"
                      />
                    ) : (
                      <div className="confirm-image-placeholder-vandana">
                        No Image
                      </div>
                    )}

                    <div className="confirm-details-vandana">
                      <strong>
                        {
                          item.product_name
                        }
                      </strong>

                      <span>
                        Brand:{' '}
                        {item.brand ||
                          '-'}
                      </span>

                      <span>
                        Gender:{' '}
                        {item.category ||
                          '-'}
                      </span>

                      <span>
                        Sub-category:{' '}
                        {item.category_path ||
                          item.category_name ||
                          '-'}
                      </span>

                      <span>
                        Design Code:{' '}
                        {item.design_code ||
                          '-'}
                      </span>

                      <span>
                        Pattern Type:{' '}
                        {item.pattern_type ||
                          '-'}
                      </span>

                      <span>
                        Pattern Code:{' '}
                        {item.pattern_code ||
                          '-'}
                      </span>

                      <span>
                        Color:{' '}
                        {item.color ||
                          '-'}
                      </span>

                      <span>
                        Size:{' '}
                        {item.size ||
                          '-'}
                      </span>

                      <span>
                        Barcode:{' '}
                        {item.barcode ||
                          '-'}
                      </span>

                      <span>
                        Stock:{' '}
                        {item.total_count ??
                          0}
                      </span>

                      <span>
                        Reserved:{' '}
                        {item.reserved_count ??
                          0}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="popup-actions-vandana">
              <button
                onClick={() =>
                  confirmDelete(
                    true
                  )
                }
              >
                Yes, Delete
                {confirmItems.length >
                1
                  ? ` ${confirmItems.length} Variants`
                  : ''}
              </button>

              <button
                onClick={() =>
                  confirmDelete(
                    false
                  )
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeleteProduct