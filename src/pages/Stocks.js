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

const toArray = (x) => (Array.isArray(x) ? x : [])
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
const safe = (v) => (v == null ? '' : String(v))
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

export default function Stocks() {
  const { user } = useAuth()
  const branchId = user?.branch_id
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [chip, setChip] = useState('All')
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('All')
  const [sortBy, setSortBy] = useState('recent')
  const [lowThreshold, setLowThreshold] = useState(10)
  const [highThreshold, setHighThreshold] = useState(100)
  const [gender, setGender] = useState('ALL')
  const searchRef = useRef(null)
  const [csvUrl, setCsvUrl] = useState('')

  useEffect(() => {
    const g = localStorage.getItem('stocks_gender') || 'ALL'
    setGender(g)
  }, [])

  const fetchStocks = useCallback(async () => {
    if (!branchId) {
      setRaw([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token') || ''
      const params = new URLSearchParams()
      if (gender !== 'ALL') params.set('gender', gender)
      const res = await fetch(
        `${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock${params.toString() ? `?${params.toString()}` : ''}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'omit',
          mode: 'cors'
        }
      )
      const data = res.ok ? await res.json() : []
      setRaw(toArray(data))
    } catch {
      setRaw([])
    } finally {
      setLoading(false)
    }
  }, [branchId, gender])

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  const rows = useMemo(
    () =>
      toArray(raw).map((s, idx) => {
        const id = s.variant_id ?? idx + 1
        const brand = safe(s.brand_name)
        const product = safe(s.product_name)
        const pattern = safe(s.pattern_code)
        const fit = safe(s.fit_type)
        const mark = safe(s.mark_code)
        const color = safe(s.colour)
        const size = safe(s.size)
        const ean = safe(s.ean_code)
        const mrp = num(s.mrp)
        const sale = num(s.sale_price)
        const cost = num(s.cost_price)
        const quantity = num(s.on_hand)
        const reserved = num(s.reserved)
        let status = 'ok'
        if (quantity <= 0) status = 'out'
        else if (quantity <= lowThreshold) status = 'low'
        else if (quantity >= highThreshold) status = 'high'
        return { id, brand, product, pattern, fit, mark, color, size, ean, mrp, sale, cost, quantity, reserved, status }
      }),
    [raw, lowThreshold, highThreshold]
  )

  const brands = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort()], [rows])

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
        [r.brand, r.product, r.pattern, r.fit, r.mark, r.color, r.size, r.ean].some((x) =>
          x.toLowerCase().includes(q)
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
    const header = ['Sl. No,Status,Brand,Product,Pattern,Fit,Mark,Size,Colour,EAN,MRP,Sale Price,Cost Price,Qty,Reserved']
    const lines = filtered.map((s, i) =>
      [
        i + 1,
        s.status.toUpperCase(),
        `"${(s.brand || '').replace(/"/g, '""')}"`,
        `"${(s.product || '').replace(/"/g, '""')}"`,
        `"${(s.pattern || '').replace(/"/g, '""')}"`,
        `"${(s.fit || '').replace(/"/g, '""')}"`,
        `"${(s.mark || '').replace(/"/g, '""')}"`,
        `"${(s.size || '').replace(/"/g, '""')}"`,
        `"${(s.color || '').replace(/"/g, '""')}"`,
        `"${(s.ean || '').replace(/"/g, '""')}"`,
        s.mrp,
        s.sale,
        s.cost,
        s.quantity,
        s.reserved
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
    localStorage.setItem('stocks_gender', g)
  }

  const clearSearch = () => {
    setSearch('')
    searchRef.current?.focus()
  }

  return (
    <div className="stocks-page-vandana-stocks">
      <Navbar />

      <div className="stocks-shell-vandana-stocks">
        <div className="stocks-hero-vandana-stocks">
          <div>
            <h2 className="stocks-title-vandana-stocks">Stocks</h2>
            <p className="stocks-subtitle-vandana-stocks">Live overview of branch inventory with clear stock alerts and smooth filtering.</p>
          </div>
          <div className="stocks-hero-actions-vandana-stocks">
            {csvUrl ? (
              <a className="stocks-export-vandana-stocks" href={csvUrl} download={`stock_${gender.toLowerCase()}.csv`}>
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
              <button
                className={`stocks-seg-btn-vandana-stocks ${gender === 'ALL' ? 'active-vandana-stocks' : ''}`}
                onClick={() => onGenderChange('ALL')}
              >
                All
              </button>
              <button
                className={`stocks-seg-btn-vandana-stocks ${gender === 'MEN' ? 'active-vandana-stocks' : ''}`}
                onClick={() => onGenderChange('MEN')}
              >
                Men
              </button>
              <button
                className={`stocks-seg-btn-vandana-stocks ${gender === 'WOMEN' ? 'active-vandana-stocks' : ''}`}
                onClick={() => onGenderChange('WOMEN')}
              >
                Women
              </button>
              <button
                className={`stocks-seg-btn-vandana-stocks ${gender === 'KIDS' ? 'active-vandana-stocks' : ''}`}
                onClick={() => onGenderChange('KIDS')}
              >
                Kids
              </button>
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
                placeholder="Search brand, product, pattern, fit, mark, color, size, EAN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="stocks-clear-vandana-stocks" onClick={clearSearch}>
                  ✕
                </button>
              )}
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
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sl. No</th>
                    <th>Status</th>
                    <th className="stocks-al-vandana-stocks">Brand</th>
                    <th className="stocks-al-vandana-stocks">Product</th>
                    <th className="stocks-al-vandana-stocks">Pattern</th>
                    <th className="stocks-al-vandana-stocks">Fit</th>
                    <th className="stocks-al-vandana-stocks">Mark</th>
                    <th>Size</th>
                    <th className="stocks-al-vandana-stocks">Colour</th>
                    <th className="stocks-al-vandana-stocks">EAN</th>
                    <th className="stocks-ar-vandana-stocks">MRP</th>
                    <th className="stocks-ar-vandana-stocks">Sale Price</th>
                    <th className="stocks-ar-vandana-stocks">Cost Price</th>
                    <th className="stocks-ar-vandana-stocks">Qty</th>
                    <th className="stocks-ar-vandana-stocks">Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, index) => (
                    <tr key={s.id} className={`stocks-row-${s.status}-vandana-stocks`}>
                      <td className="stocks-mono-vandana-stocks">{index + 1}</td>
                      <td>
                        <span className={`stocks-status-vandana-stocks ${s.status}`}>
                          {s.status === 'out' ? 'Out' : s.status === 'low' ? 'Low' : s.status === 'high' ? 'High' : 'OK'}
                        </span>
                      </td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.brand}>{s.brand || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.product}>{s.product || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.pattern}>{s.pattern || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.fit}>{s.fit || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.mark}>{s.mark || '-'}</td>
                      <td className="stocks-mono-vandana-stocks">{s.size || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-truncate-vandana-stocks" title={s.color}>{s.color || '-'}</td>
                      <td className="stocks-al-vandana-stocks stocks-mono-vandana-stocks stocks-truncate-vandana-stocks" title={s.ean}>{s.ean || '-'}</td>
                      <td className="stocks-ar-vandana-stocks">{cf(s.mrp)}</td>
                      <td className="stocks-ar-vandana-stocks">{cf(s.sale)}</td>
                      <td className="stocks-ar-vandana-stocks">{cf(s.cost)}</td>
                      <td className="stocks-ar-vandana-stocks">{nf(s.quantity)}</td>
                      <td className="stocks-ar-vandana-stocks">{nf(s.reserved)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan="15" className="stocks-empty-vandana-stocks">
                        No matching records
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}