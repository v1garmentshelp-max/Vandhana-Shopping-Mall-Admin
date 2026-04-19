import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Stocks.css'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'

const DEFAULT_API_BASE = 'https://taras-kart-backend.vercel.app'
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
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'
}
const cf = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
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
      const res = await fetch(`${API_BASE}/api/branch/${encodeURIComponent(branchId)}/stock${params.toString() ? `?${params.toString()}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'omit',
        mode: 'cors'
      })
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
        [r.brand, r.product, r.pattern, r.fit, r.mark, r.color, r.size, r.ean].some((x) => x.toLowerCase().includes(q))
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
    <div className="stocks-page">
      <Navbar />
      <div className="stocks-toolbar">
        <div className="bar-row">
          <div className="seg">
            <button className={`seg-btn ${gender === 'ALL' ? 'active' : ''}`} onClick={() => onGenderChange('ALL')}>All</button>
            <button className={`seg-btn ${gender === 'MEN' ? 'active' : ''}`} onClick={() => onGenderChange('MEN')}>Men</button>
            <button className={`seg-btn ${gender === 'WOMEN' ? 'active' : ''}`} onClick={() => onGenderChange('WOMEN')}>Women</button>
            <button className={`seg-btn ${gender === 'KIDS' ? 'active' : ''}`} onClick={() => onGenderChange('KIDS')}>Kids</button>
          </div>
          <div className="right-tools">
            {csvUrl ? (
              <a className="export" href={csvUrl} download={`stock_${gender.toLowerCase()}.csv`}>Export CSV</a>
            ) : (
              <button className="export disabled" disabled>Export CSV</button>
            )}
            <button className="refresh" onClick={fetchStocks}>{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
        </div>

        <div className="summary-cards">
          <div className="card">
            <div className="card-title">Total SKUs</div>
            <div className="card-value">{nf(counts.totalSkus)}</div>
          </div>
          <div className="card">
            <div className="card-title">Total Units</div>
            <div className="card-value">{nf(counts.totalUnits)}</div>
          </div>
          <div className="card warn">
            <div className="card-title">Low Stock</div>
            <div className="card-value">{nf(counts.low)}</div>
          </div>
          <div className="card danger">
            <div className="card-title">Out of Stock</div>
            <div className="card-value">{nf(counts.out)}</div>
          </div>
          <div className="card ok">
            <div className="card-title">High Stock</div>
            <div className="card-value">{nf(counts.high)}</div>
          </div>
        </div>

        <div className="chips">
          {['All', 'Alerts', 'Low Stock', 'High Stock', 'Out of Stock'].map((c) => (
            <button key={c} className={`chip ${chip === c ? 'active' : ''}`} onClick={() => setChip(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="control-row">
          <div className="search-wrap">
            <input
              ref={searchRef}
              className="search"
              placeholder="Search brand, product, pattern, fit, mark, color, size, EAN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear" onClick={clearSearch}>✕</button>}
          </div>
          <select className="select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="qty_desc">Qty: High → Low</option>
            <option value="qty_asc">Qty: Low → High</option>
            <option value="mrp_desc">MRP: High → Low</option>
            <option value="mrp_asc">MRP: Low → High</option>
            <option value="sale_desc">Sale Price: High → Low</option>
            <option value="sale_asc">Sale Price: Low → High</option>
            <option value="brand_asc">Brand: A → Z</option>
          </select>
        </div>

        <div className="thresholds">
          <div className="threshold">
            <label>Low ≤</label>
            <input
              type="number"
              min="0"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(Math.max(0, parseInt(e.target.value || '0', 10)))}
            />
          </div>
          <div className="threshold">
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

      <div className="section-table">
        <h3>Live Stock Overview</h3>
        {loading ? (
          <p>Loading stocks...</p>
        ) : (
          <div className="table-container">
            <table className="stock-table">
              <colgroup>
                <col style={{ width: '70px' }} />
                <col style={{ width: '90px' }} />
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
                  <th className="al">Brand</th>
                  <th className="al">Product</th>
                  <th className="al">Pattern</th>
                  <th className="al">Fit</th>
                  <th className="al">Mark</th>
                  <th>Size</th>
                  <th className="al">Colour</th>
                  <th className="al">EAN</th>
                  <th className="ar">MRP</th>
                  <th className="ar">Sale Price</th>
                  <th className="ar">Cost Price</th>
                  <th className="ar">Qty</th>
                  <th className="ar">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, index) => (
                  <tr key={s.id} className={`row-${s.status}`}>
                    <td className="mono">{index + 1}</td>
                    <td>
                      <span className={`status ${s.status}`}>
                        {s.status === 'out' ? 'Out' : s.status === 'low' ? 'Low' : s.status === 'high' ? 'High' : 'OK'}
                      </span>
                    </td>
                    <td className="al truncate" title={s.brand}>{s.brand || '-'}</td>
                    <td className="al truncate" title={s.product}>{s.product || '-'}</td>
                    <td className="al truncate" title={s.pattern}>{s.pattern || '-'}</td>
                    <td className="al truncate" title={s.fit}>{s.fit || '-'}</td>
                    <td className="al truncate" title={s.mark}>{s.mark || '-'}</td>
                    <td className="mono">{s.size || '-'}</td>
                    <td className="al truncate" title={s.color}>{s.color || '-'}</td>
                    <td className="al mono truncate" title={s.ean}>{s.ean || '-'}</td>
                    <td className="ar">{cf(s.mrp)}</td>
                    <td className="ar">{cf(s.sale)}</td>
                    <td className="ar">{cf(s.cost)}</td>
                    <td className="ar">{nf(s.quantity)}</td>
                    <td className="ar">{nf(s.reserved)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan="15" style={{ padding: 16, color: 'gold' }}>No matching records</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}