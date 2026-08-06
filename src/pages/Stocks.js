import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Stocks.css'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')
const DEFAULT_BRANCH_ID = 3

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

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

const safe = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

const nf = (v) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '-'
}

const cf = (v) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-'
}

const normalizeGender = (value) => {
  const v = String(value || '').trim().toUpperCase()
  if (v.includes('WOMEN') || v === 'FEMALE') return 'WOMEN'
  if (v.includes('KID') || v.includes('CHILD')) return 'KIDS'
  if (v.includes('MEN') || v === 'MALE') return 'MEN'
  return v || 'ALL'
}

const splitValues = (value) => {
  const text = safe(value)
  if (!text) return []
  return text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

const DisplayValue = ({ value, mono = false }) => {
  const parts = splitValues(value)

  if (!parts.length) return <span>-</span>

  if (parts.length === 1) {
    return <span className={mono ? 'stocks-mono-vandana-stocks' : ''}>{parts[0]}</span>
  }

  return (
    <div className="stocks-value-list-vandana-stocks">
      {parts.map((part, index) => (
        <span className={`stocks-value-pill-vandana-stocks ${mono ? 'stocks-mono-vandana-stocks' : ''}`} key={`${part}-${index}`}>
          {part}
        </span>
      ))}
    </div>
  )
}

export default function Stocks() {
  const { user, token } = useAuth()
  const role = String(user?.role_enum || user?.role || '').toUpperCase()
  const userBranchId = Number(user?.branch_id || 0)
  const isSuper = role === 'SUPER_ADMIN'
  const initialBranchId = userBranchId || Number(localStorage.getItem('stocks_branch_id') || DEFAULT_BRANCH_ID)

  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId)
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [chip, setChip] = useState('All')
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('All')
  const [sortBy, setSortBy] = useState('recent')
  const [lowThreshold, setLowThreshold] = useState(10)
  const [highThreshold, setHighThreshold] = useState(100)
  const [gender, setGender] = useState('ALL')
  const [csvUrl, setCsvUrl] = useState('')
  const [error, setError] = useState('')
  const searchRef = useRef(null)

  const branchId = userBranchId || selectedBranchId || DEFAULT_BRANCH_ID

  useEffect(() => {
    const g = localStorage.getItem('stocks_gender') || 'ALL'
    setGender(g)
  }, [])

  useEffect(() => {
    if (userBranchId) setSelectedBranchId(userBranchId)
  }, [userBranchId])

  const fetchStocks = useCallback(async () => {
    const activeBranchId = Number(branchId || DEFAULT_BRANCH_ID)

    if (!activeBranchId) {
      setRaw([])
      setLoading(false)
      setError('Branch ID is missing')
      return
    }

    setLoading(true)
    setError('')

    try {
      const storedToken =
        token ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('admin_token') ||
        ''

      const params = new URLSearchParams()
      if (gender !== 'ALL') params.set('gender', gender)

      const res = await fetch(
        `${API_BASE}/api/branch/${encodeURIComponent(activeBranchId)}/stock${params.toString() ? `?${params.toString()}` : ''}`,
        {
          method: 'GET',
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
          credentials: 'omit',
          mode: 'cors'
        }
      )

      const data = await res.json().catch(() => [])

      if (!res.ok) {
        throw new Error(data?.message || `Unable to load stocks. Status ${res.status}`)
      }

      setRaw(toArray(data))
    } catch (err) {
      setRaw([])
      setError(err?.message || 'Unable to load stocks')
    } finally {
      setLoading(false)
    }
  }, [branchId, gender, token])

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  const rows = useMemo(() => {
    const output = []

    toArray(raw).forEach((s, idx) => {
      const variants = Array.isArray(s?.variants) ? s.variants : []

      if (variants.length) {
        variants.forEach((v, variantIndex) => {
          const id = Number(v.variant_id ?? v.variantId ?? v.id ?? `${idx + 1}${variantIndex + 1}`)
          const brand = safe(s.brand_name ?? s.brand ?? s.brandName ?? v.brand_name ?? v.brand)
          const product = safe(s.product_name ?? s.name ?? s.product ?? s.title ?? v.product_name ?? v.name)
          const designCode = safe(s.design_code ?? s.designCode ?? v.design_code ?? v.designCode)
          const patternType = safe(s.pattern_type ?? s.patternType ?? v.pattern_type ?? v.patternType)
          const patternCode = safe(s.pattern_code ?? s.patternCode ?? v.pattern_code ?? v.patternCode)
          const color = safe(v.colour ?? v.color ?? s.selected_color)
          const size = safe(v.size ?? s.selected_size)
          const ean = safe(v.ean_code ?? v.ean ?? v.barcode ?? s.ean_code ?? s.barcode)
          const rowGender = normalizeGender(s.gender ?? v.gender)
          const mrp = num(v.mrp ?? v.original_price_b2c ?? v.originalPrice ?? s.mrp ?? s.original_price_b2c)
          const sale = num(v.sale_price ?? v.final_price_b2c ?? v.salePrice ?? v.price ?? s.sale_price ?? s.final_price_b2c)
          const quantity = num(v.on_hand ?? v.stock ?? v.qty ?? v.quantity ?? v.available_qty)
          let status = 'ok'

          if (quantity <= 0) status = 'out'
          else if (quantity <= lowThreshold) status = 'low'
          else if (quantity >= highThreshold) status = 'high'

          output.push({
            id,
            rowKey: `${id}-${ean}-${variantIndex}`,
            brand,
            product,
            designCode,
            patternType,
            patternCode,
            color,
            size,
            ean,
            gender: rowGender,
            mrp,
            sale,
            quantity,
            status
          })
        })

        return
      }

      const id = Number(s.variant_id ?? s.variantId ?? s.id ?? idx + 1)
      const brand = safe(s.brand_name ?? s.brand ?? s.brandName)
      const product = safe(s.product_name ?? s.name ?? s.product ?? s.title)
      const designCode = safe(s.design_code ?? s.designCode)
      const patternType = safe(s.pattern_type ?? s.patternType)
      const patternCode = safe(s.pattern_code ?? s.patternCode)
      const color = safe(s.colour ?? s.color ?? s.selected_color)
      const size = safe(s.size ?? s.selected_size)
      const ean = safe(s.ean_code ?? s.ean ?? s.barcode ?? s.barcode_value)
      const rowGender = normalizeGender(s.gender)
      const mrp = num(s.mrp ?? s.original_price_b2c ?? s.originalPrice)
      const sale = num(s.sale_price ?? s.final_price_b2c ?? s.salePrice ?? s.price)
      const quantity = num(s.on_hand ?? s.stock ?? s.qty ?? s.quantity)
      let status = 'ok'

      if (quantity <= 0) status = 'out'
      else if (quantity <= lowThreshold) status = 'low'
      else if (quantity >= highThreshold) status = 'high'

      output.push({
        id,
        rowKey: `${id}-${ean}-${idx}`,
        brand,
        product,
        designCode,
        patternType,
        patternCode,
        color,
        size,
        ean,
        gender: rowGender,
        mrp,
        sale,
        quantity,
        status
      })
    })

    return output
  }, [raw, lowThreshold, highThreshold])

  const brands = useMemo(() => {
    return ['All', ...Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort()]
  }, [rows])

  useEffect(() => {
    if (brand !== 'All' && !brands.includes(brand)) setBrand('All')
  }, [brand, brands])

  const counts = useMemo(() => {
    const totalUnits = rows.reduce((a, b) => a + b.quantity, 0)
    const out = rows.filter((r) => r.status === 'out').length
    const low = rows.filter((r) => r.status === 'low').length
    const high = rows.filter((r) => r.status === 'high').length
    return { totalSkus: rows.length, totalUnits, out, low, high }
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows

    if (chip === 'Alerts') list = list.filter((r) => r.status === 'out' || r.status === 'low')
    if (chip === 'Low Stock') list = list.filter((r) => r.status === 'low')
    if (chip === 'High Stock') list = list.filter((r) => r.status === 'high')
    if (chip === 'Out of Stock') list = list.filter((r) => r.status === 'out')
    if (brand !== 'All') list = list.filter((r) => r.brand === brand)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) =>
        [r.brand, r.product, r.designCode, r.patternType, r.patternCode, r.color, r.size, r.ean, r.gender].some((x) =>
          String(x || '').toLowerCase().includes(q)
        )
      )
    }

    const sorted = [...list]

    if (sortBy === 'recent') sorted.sort((a, b) => b.id - a.id)
    if (sortBy === 'qty_desc') sorted.sort((a, b) => b.quantity - a.quantity)
    if (sortBy === 'qty_asc') sorted.sort((a, b) => a.quantity - b.quantity)
    if (sortBy === 'mrp_desc') sorted.sort((a, b) => b.mrp - a.mrp)
    if (sortBy === 'mrp_asc') sorted.sort((a, b) => a.mrp - b.mrp)
    if (sortBy === 'sale_desc') sorted.sort((a, b) => b.sale - a.sale)
    if (sortBy === 'sale_asc') sorted.sort((a, b) => a.sale - b.sale)
    if (sortBy === 'brand_asc') sorted.sort((a, b) => a.brand.localeCompare(b.brand))

    return sorted
  }, [rows, chip, brand, search, sortBy])

  useEffect(() => {
    if (!filtered.length) {
      setCsvUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return ''
      })
      return
    }

    const header = ['Sl. No,Status,Gender,Brand,Product,Design Code,Pattern Type,Pattern Code,Size,Colour,EAN,MRP,Sale Price,Qty']

    const lines = filtered.map((s, i) =>
      [
        i + 1,
        s.status.toUpperCase(),
        `"${(s.gender || '').replace(/"/g, '""')}"`,
        `"${(s.brand || '').replace(/"/g, '""')}"`,
        `"${(s.product || '').replace(/"/g, '""')}"`,
        `"${(s.designCode || '').replace(/"/g, '""')}"`,
        `"${(s.patternType || '').replace(/"/g, '""')}"`,
        `"${(s.patternCode || '').replace(/"/g, '""')}"`,
        `"${(s.size || '').replace(/"/g, '""')}"`,
        `"${(s.color || '').replace(/"/g, '""')}"`,
        `"${(s.ean || '').replace(/"/g, '""')}"`,
        s.mrp,
        s.sale,
        s.quantity
      ].join(',')
    )

    const csv = [...header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    setCsvUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [filtered])

  useEffect(() => {
    return () => {
      if (csvUrl) URL.revokeObjectURL(csvUrl)
    }
  }, [csvUrl])

  const onGenderChange = (g) => {
    setGender(g)
    setChip('All')
    setBrand('All')
    setSearch('')
    localStorage.setItem('stocks_gender', g)
  }

  const onBranchChange = (value) => {
    const next = Math.max(1, parseInt(value || DEFAULT_BRANCH_ID, 10) || DEFAULT_BRANCH_ID)
    setSelectedBranchId(next)
    localStorage.setItem('stocks_branch_id', String(next))
  }

  const clearSearch = () => {
    setSearch('')
    searchRef.current?.focus()
  }

  const resetFilters = () => {
    setChip('All')
    setSearch('')
    setBrand('All')
    setSortBy('recent')
  }

  return (
    <div className="stocks-page-vandana-stocks">
      <Navbar />

      <div className="stocks-shell-vandana-stocks">
        <div className="stocks-hero-vandana-stocks">
          <div className="stocks-hero-text-vandana-stocks">
            <h2 className="stocks-title-vandana-stocks">Stocks</h2>
            <p className="stocks-subtitle-vandana-stocks">
              Live overview of branch inventory with clear stock alerts and smooth filtering.
            </p>
          </div>

          <div className="stocks-hero-actions-vandana-stocks">
            {isSuper ? (
              <input
                className="stocks-select-vandana-stocks stocks-branch-input-vandana-stocks"
                type="number"
                min="1"
                value={selectedBranchId}
                onChange={(e) => onBranchChange(e.target.value)}
              />
            ) : null}

            {csvUrl ? (
              <a className="stocks-export-vandana-stocks" href={csvUrl} download={`stock_branch_${branchId}_${gender.toLowerCase()}.csv`}>
                Export CSV
              </a>
            ) : (
              <button className="stocks-export-vandana-stocks stocks-export-disabled-vandana-stocks" disabled>
                Export CSV
              </button>
            )}

            <button className="stocks-refresh-vandana-stocks" onClick={fetchStocks}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="stocks-toolbar-vandana-stocks">
          <div className="stocks-bar-row-vandana-stocks">
            <div className="stocks-seg-vandana-stocks">
              {['ALL', 'MEN', 'WOMEN', 'KIDS'].map((g) => (
                <button
                  key={g}
                  className={`stocks-seg-btn-vandana-stocks ${gender === g ? 'active-vandana-stocks' : ''}`}
                  onClick={() => onGenderChange(g)}
                >
                  {g === 'ALL' ? 'All' : g === 'MEN' ? 'Men' : g === 'WOMEN' ? 'Women' : 'Kids'}
                </button>
              ))}
            </div>
          </div>

          <div className="stocks-summary-cards-vandana-stocks">
            <div className="stocks-card-vandana-stocks">
              <div className="stocks-card-title-vandana-stocks">Total SKUs</div>
              <div className="stocks-card-value-vandana-stocks">{nf(counts.totalSkus)}</div>
            </div>
            <div className="stocks-card-vandana-stocks">
              <div className="stocks-card-title-vandana-stocks">Total Units</div>
              <div className="stocks-card-value-vandana-stocks">{nf(counts.totalUnits)}</div>
            </div>
            <div className="stocks-card-vandana-stocks stocks-card-warn-vandana-stocks">
              <div className="stocks-card-title-vandana-stocks">Low Stock</div>
              <div className="stocks-card-value-vandana-stocks">{nf(counts.low)}</div>
            </div>
            <div className="stocks-card-vandana-stocks stocks-card-danger-vandana-stocks">
              <div className="stocks-card-title-vandana-stocks">Out of Stock</div>
              <div className="stocks-card-value-vandana-stocks">{nf(counts.out)}</div>
            </div>
            <div className="stocks-card-vandana-stocks stocks-card-ok-vandana-stocks">
              <div className="stocks-card-title-vandana-stocks">High Stock</div>
              <div className="stocks-card-value-vandana-stocks">{nf(counts.high)}</div>
            </div>
          </div>

          <div className="stocks-chips-vandana-stocks">
            {['All', 'Alerts', 'Low Stock', 'High Stock', 'Out of Stock'].map((c) => (
              <button
                key={c}
                className={`stocks-chip-vandana-stocks ${chip === c ? 'active-vandana-stocks' : ''}`}
                onClick={() => setChip(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="stocks-control-row-vandana-stocks">
            <div className="stocks-search-wrap-vandana-stocks">
              <input
                ref={searchRef}
                className="stocks-search-vandana-stocks"
                placeholder="Search brand, product, design code, pattern type, color, size or EAN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button className="stocks-clear-vandana-stocks" onClick={clearSearch}>
                  ✕
                </button>
              ) : null}
            </div>

            <select className="stocks-select-vandana-stocks" value={brand} onChange={(e) => setBrand(e.target.value)}>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select className="stocks-select-vandana-stocks" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Sort: Recent</option>
              <option value="qty_desc">Qty: High to Low</option>
              <option value="qty_asc">Qty: Low to High</option>
              <option value="mrp_desc">MRP: High to Low</option>
              <option value="mrp_asc">MRP: Low to High</option>
              <option value="sale_desc">Sale Price: High to Low</option>
              <option value="sale_asc">Sale Price: Low to High</option>
              <option value="brand_asc">Brand: A to Z</option>
            </select>

            <button className="stocks-refresh-vandana-stocks" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <div className="stocks-thresholds-vandana-stocks">
            <div className="stocks-threshold-vandana-stocks">
              <label>Low ≤</label>
              <input
                type="number"
                min="0"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Math.max(0, parseInt(e.target.value || '0', 10)))}
              />
            </div>
            <div className="stocks-threshold-vandana-stocks">
              <label>High ≥</label>
              <input
                type="number"
                min="0"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Math.max(0, parseInt(e.target.value || '0', 10)))}
              />
            </div>
          </div>

          {error ? (
            <div className="stocks-error-vandana-stocks">
              {error}
            </div>
          ) : null}
        </div>

        <div className="stocks-section-table-vandana-stocks">
          <div className="stocks-table-head-vandana-stocks">
            <h3>Live Stock Overview</h3>
            <span>{nf(filtered.length)} records</span>
          </div>

          {loading ? (
            <p className="stocks-loading-vandana-stocks">Loading stocks...</p>
          ) : (
            <div className="stocks-table-container-vandana-stocks">
              <table className="stocks-stock-table-vandana-stocks">
                <colgroup>
                  <col className="stocks-col-sl-vandana-stocks" />
                  <col className="stocks-col-status-vandana-stocks" />
                  <col className="stocks-col-gender-vandana-stocks" />
                  <col className="stocks-col-brand-vandana-stocks" />
                  <col className="stocks-col-product-vandana-stocks" />
                  <col className="stocks-col-product-vandana-stocks" />
                  <col className="stocks-col-product-vandana-stocks" />
                  <col className="stocks-col-product-vandana-stocks" />
                  <col className="stocks-col-size-vandana-stocks" />
                  <col className="stocks-col-color-vandana-stocks" />
                  <col className="stocks-col-ean-vandana-stocks" />
                  <col className="stocks-col-money-vandana-stocks" />
                  <col className="stocks-col-money-vandana-stocks" />
                  <col className="stocks-col-qty-vandana-stocks" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sl. No</th>
                    <th>Status</th>
                    <th>Gender</th>
                    <th className="stocks-al-vandana-stocks">Brand</th>
                    <th className="stocks-al-vandana-stocks">Product</th>
                    <th className="stocks-al-vandana-stocks">Design Code</th>
                    <th className="stocks-al-vandana-stocks">Pattern Type</th>
                    <th className="stocks-al-vandana-stocks">Pattern Code</th>
                    <th>Size</th>
                    <th className="stocks-al-vandana-stocks">Colour</th>
                    <th className="stocks-al-vandana-stocks">EAN</th>
                    <th className="stocks-ar-vandana-stocks">MRP</th>
                    <th className="stocks-ar-vandana-stocks">Sale Price</th>
                    <th className="stocks-ar-vandana-stocks">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, index) => (
                    <tr key={`${s.rowKey}-${index}`} className={`stocks-row-${s.status}-vandana-stocks`}>
                      <td className="stocks-mono-vandana-stocks">{index + 1}</td>
                      <td>
                        <span className={`stocks-status-vandana-stocks ${s.status}`}>
                          {s.status === 'out' ? 'Out' : s.status === 'low' ? 'Low' : s.status === 'high' ? 'High' : 'OK'}
                        </span>
                      </td>
                      <td className="stocks-mono-vandana-stocks">{s.gender || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.brand}>{s.brand || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.product}>{s.product || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.designCode}>
                        <DisplayValue value={s.designCode} mono />
                      </td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.patternType}>
                        <DisplayValue value={s.patternType} />
                      </td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.patternCode}>
                        <DisplayValue value={s.patternCode} mono />
                      </td>
                      <td className="stocks-wrap-cell-vandana-stocks">
                        <DisplayValue value={s.size} mono />
                      </td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.color}>
                        <DisplayValue value={s.color} />
                      </td>
                      <td className="stocks-al-vandana-stocks stocks-wrap-cell-vandana-stocks" title={s.ean}>
                        <DisplayValue value={s.ean} mono />
                      </td>
                      <td className="stocks-ar-vandana-stocks">{cf(s.mrp)}</td>
                      <td className="stocks-ar-vandana-stocks">{cf(s.sale)}</td>
                      <td className="stocks-ar-vandana-stocks">{nf(s.quantity)}</td>
                    </tr>
                  ))}

                  {!filtered.length ? (
                    <tr>
                      <td colSpan={14} className="stocks-empty-vandana-stocks">
                        {rows.length ? 'No matching records. Clear filters or search.' : `No stock records found for branch ${branchId}.`}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}