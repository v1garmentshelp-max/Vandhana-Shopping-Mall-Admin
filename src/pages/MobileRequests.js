import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NavbarAdmin from './NavbarAdmin'
import { apiGet } from './api'
import './MobileRequests.css'

const PENDING_STATUSES = ['REQUESTED', 'PENDING', 'REVIEW_REQUIRED', 'IN_REVIEW', 'PROCESSING']
const COMPLETED_STATUSES = ['COMPLETED', 'DELETED', 'CLOSED']
const DAY = 86400000
const statusOf = row => String(row.status || 'UNKNOWN').trim().toUpperCase()
const labelOf = value => String(value || 'Unknown').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const timestampOf = row => {
  const value = row.created_at ? new Date(row.created_at).getTime() : NaN
  return Number.isNaN(value) ? 0 : value
}
const dateOf = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not available'
}
const requestLabel = row => row.type === 'DELETE_ACCOUNT' || !row.type ? 'Account deletion' : labelOf(row.type)
const initialsOf = name => String(name || 'Customer').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()

function RequestIcon({ name }) {
  const paths = {
    refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6.1 7a7 7 0 0 1 11.6-2L20 8', 'M4 16l2.3 3A7 7 0 0 0 17.9 17'],
    search: ['M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15', 'M16 16l5 5'],
    download: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 16v5h16v-5'],
    inbox: ['M5 4h14l3 11v5H2v-5z', 'M2 15h6l2 3h4l2-3h6'],
    clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l3 2'],
    check: ['M5 12l4 4L19 6'],
    arrow: ['M5 12h14', 'M14 7l5 5-5 5'],
    left: ['M15 6l-6 6 6 6'],
    right: ['M9 6l6 6-6 6'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    copy: ['M9 9h12v12H9z', 'M15 9V3H3v12h6'],
    shield: ['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z', 'M8 12l3 3 5-6']
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] || paths.inbox).map((path, index) => <path key={index} d={path} />)}</svg>
}

function StatusBadge({ row }) {
  const status = statusOf(row)
  const tone = PENDING_STATUSES.includes(status) ? 'pending' : COMPLETED_STATUSES.includes(status) ? 'complete' : ['REJECTED', 'CANCELLED'].includes(status) ? 'closed' : 'neutral'
  return <span className={`mr-badge mr-badge-${tone}`}><span />{labelOf(status)}</span>
}

function Customer({ row }) {
  return <div className="mr-customer"><span className="mr-avatar" aria-hidden="true">{initialsOf(row.name)}</span><div><strong>{row.name || 'Unnamed customer'}</strong><span>{row.email || 'Email unavailable'}</span><small>Customer #{row.user_id ?? 'Unknown'}</small></div></div>
}

function csvCell(value) {
  let text = String(value ?? '')
  let offset = 0
  while (offset < text.length && (text.charCodeAt(offset) <= 32 || /\s/.test(text[offset]))) offset += 1
  if (/^[=+@-]/.test(text.slice(offset)) || ['\t', '\r', '\n'].includes(text[0])) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export default function MobileRequests() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [lastLoaded, setLastLoaded] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [dateRange, setDateRange] = useState('ALL')
  const [sort, setSort] = useState('NEWEST')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(null)
  const [copyMessage, setCopyMessage] = useState('')
  const controllerRef = useRef(null)
  const dialogRef = useRef(null)
  const copyTimer = useRef(null)
  const now = lastLoaded ? lastLoaded.getTime() : Date.now()

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setBusy(true)
    setError('')
    try {
      const data = await apiGet('/mobile/admin/account-requests', {}, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!Array.isArray(data)) throw new Error('Account requests could not be read. Please refresh to try again.')
      setRows(data)
      setLastLoaded(new Date())
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Requests could not be loaded.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => { controllerRef.current?.abort(); window.clearTimeout(copyTimer.current) }
  }, [load])

  useEffect(() => { setPage(1) }, [query, status, dateRange, sort, pageSize])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (selected) {
      if (!dialog.open) dialog.showModal()
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previous }
    }
    if (dialog.open) dialog.close()
    return undefined
  }, [selected])

  const statuses = useMemo(() => [...new Set(rows.map(statusOf))].sort(), [rows])
  const awaitingReview = rows.filter(row => PENDING_STATUSES.includes(statusOf(row))).length
  const completed = rows.filter(row => COMPLETED_STATUSES.includes(statusOf(row))).length
  const olderRequests = rows.filter(row => PENDING_STATUSES.includes(statusOf(row)) && timestampOf(row) > 0 && now - timestampOf(row) >= 7 * DAY).length
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    const result = rows.filter(row => {
      if (search && ![row.name, row.email, row.id, row.user_id, requestLabel(row)].some(value => String(value ?? '').toLowerCase().includes(search))) return false
      if (status !== 'ALL' && statusOf(row) !== status) return false
      if (dateRange === 'ALL') return true
      const received = timestampOf(row)
      if (!received) return false
      const age = now - received
      if (dateRange === 'OLDER_7') return age >= 7 * DAY
      return age >= 0 && age <= (dateRange === '7' ? 7 : 30) * DAY
    })
    return result.sort((left, right) => {
      if (sort === 'CUSTOMER') return String(left.name || '').localeCompare(String(right.name || ''), 'en', { sensitivity: 'base' }) || String(left.id).localeCompare(String(right.id))
      return sort === 'OLDEST' ? timestampOf(left) - timestampOf(right) : timestampOf(right) - timestampOf(left)
    })
  }, [rows, query, status, dateRange, sort, now])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = Boolean(query || status !== 'ALL' || dateRange !== 'ALL')

  function clearFilters() {
    setQuery('')
    setStatus('ALL')
    setDateRange('ALL')
    setPage(1)
  }

  function viewRequest(row) {
    setCopyMessage('')
    window.clearTimeout(copyTimer.current)
    setSelected(row)
  }

  async function copyReference(value) {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopyMessage('Reference copied')
    } catch {
      setCopyMessage('Copy unavailable. Select the reference below to copy it.')
    }
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyMessage(''), 4000)
  }

  function exportResults() {
    const headings = ['Reference', 'Customer ID', 'Customer name', 'Email', 'Request', 'Status', 'Received (ISO)']
    const records = filtered.map(row => [row.id, row.user_id, row.name, row.email, requestLabel(row), statusOf(row), timestampOf(row) ? new Date(row.created_at).toISOString() : ''])
    const content = '\uFEFF' + [headings, ...records].map(record => record.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `mobile-account-requests-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function closeFromBackdrop(event) {
    if (event.target !== dialogRef.current) return
    const rect = dialogRef.current.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSelected(null)
  }

  return <>
    <NavbarAdmin />
    <main className="mr-page">
      <div className="mr-shell">
        <header className="mr-header"><div><span className="mr-eyebrow">CUSTOMER CARE</span><h1>Account requests<span className="mr-title-dot" /></h1><p>Keep customer account requests organised and easy to review.</p></div><div className="mr-header-actions"><button type="button" className="mr-button mr-button-secondary" disabled={busy || filtered.length === 0} onClick={exportResults}><RequestIcon name="download" />Export results</button><button type="button" className="mr-button mr-button-primary" onClick={load} disabled={busy}><RequestIcon name="refresh" />{busy ? 'Refreshing…' : 'Refresh requests'}</button></div></header>

        <div className="mr-stats"><article><span className="mr-stat-icon"><RequestIcon name="inbox" /></span><div><span>Total requests</span><strong>{!lastLoaded && busy ? '—' : rows.length}</strong></div><small>Latest requests loaded</small></article><article><span className="mr-stat-icon mr-stat-amber"><RequestIcon name="clock" /></span><div><span>Awaiting review</span><strong>{!lastLoaded && busy ? '—' : awaitingReview}</strong></div><small>{olderRequests ? `${olderRequests} waiting 7 days or more` : 'Requests needing attention'}</small></article><article><span className="mr-stat-icon mr-stat-green"><RequestIcon name="check" /></span><div><span>Completed</span><strong>{!lastLoaded && busy ? '—' : completed}</strong></div><small>Completed, deleted or closed</small></article></div>

        <div className="mr-info"><span className="mr-info-icon"><RequestIcon name="shield" /></span><div><strong>Review each request before processing</strong><p>Verify customer ownership and follow your store's account deletion procedure. A recorded request does not delete the account.</p></div></div>
        {error && <div className="mr-error" role="alert"><span>{error}{lastLoaded ? ' Showing your last successfully loaded requests.' : ''}</span><button type="button" onClick={load} disabled={busy}>Try again</button></div>}

        <section className="mr-panel" aria-labelledby="mr-list-title" aria-busy={busy}>
          <div className="mr-panel-heading"><div><h2 id="mr-list-title">Customer requests <span className="mr-count">{rows.length}</span></h2><p>Search, filter and inspect the latest 200 requests.</p></div><span className="mr-updated"><span className={busy ? 'mr-dot mr-dot-loading' : 'mr-dot'} />{busy ? 'Updating requests' : lastLoaded ? `Updated ${lastLoaded.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for data'}</span></div>
          <div className="mr-toolbar"><label className="mr-search"><span className="mr-sr-only">Search requests</span><RequestIcon name="search" /><input type="search" value={query} placeholder="Search name, email or reference" onChange={event => setQuery(event.target.value)} /></label><label className="mr-select"><span className="mr-sr-only">Filter by status</span><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All statuses</option>{[...new Set([...statuses, ...(status === 'ALL' ? [] : [status])])].map(value => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label><label className="mr-select"><span className="mr-sr-only">Filter by date</span><select aria-label="Filter by date" value={dateRange} onChange={event => setDateRange(event.target.value)}><option value="ALL">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="OLDER_7">Older than 7 days</option></select></label><label className="mr-select"><span className="mr-sr-only">Sort requests</span><select aria-label="Sort requests" value={sort} onChange={event => setSort(event.target.value)}><option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option><option value="CUSTOMER">Customer A–Z</option></select></label></div>
          {hasFilters && <div className="mr-filter-summary"><span>{filtered.length} matching {filtered.length === 1 ? 'request' : 'requests'}</span><button type="button" onClick={clearFilters}>Clear filters <RequestIcon name="close" /></button></div>}

          {!lastLoaded && busy ? <div className="mr-loading" role="status"><RequestIcon name="refresh" /><strong>Loading customer requests</strong><span>Getting the latest requests from your store.</span></div> : filtered.length === 0 ? <div className="mr-empty"><span className="mr-empty-icon"><RequestIcon name={hasFilters ? 'search' : 'inbox'} /></span><h3>{error && !lastLoaded ? 'Requests unavailable' : hasFilters ? 'No matching requests' : 'Your request queue is clear'}</h3><p>{error && !lastLoaded ? 'Try again to load your customer requests.' : hasFilters ? 'Try another search or clear your filters.' : 'Account requests submitted from the mobile app will appear here.'}</p>{hasFilters && <button type="button" className="mr-button mr-button-secondary" onClick={clearFilters}>Clear filters</button>}</div> : <>
            <div className="mr-table-wrap" role="region" aria-label="Customer account requests" tabIndex={0}><table className="mr-table"><thead><tr><th scope="col">Customer</th><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Received</th><th scope="col"><span className="mr-sr-only">Actions</span></th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td><Customer row={row} /></td><td><strong className="mr-request-type">{requestLabel(row)}</strong><code className="mr-reference" title={String(row.id)}>#{String(row.id || '').slice(0, 12)}</code></td><td><StatusBadge row={row} />{PENDING_STATUSES.includes(statusOf(row)) && timestampOf(row) > 0 && now - timestampOf(row) >= 7 * DAY && <small className="mr-waiting">Waiting {Math.floor((now - timestampOf(row)) / DAY)} days</small>}</td><td><span className="mr-date">{dateOf(row.created_at)}</span></td><td><button type="button" className="mr-view" onClick={() => viewRequest(row)} aria-label={`View request for ${row.name || 'customer'}`}>View <RequestIcon name="arrow" /></button></td></tr>)}</tbody></table></div>
            <div className="mr-cards">{visible.map(row => <article className="mr-card" key={row.id}><div className="mr-card-top"><Customer row={row} /><StatusBadge row={row} /></div><div className="mr-card-details"><div><span>Request</span><strong>{requestLabel(row)}</strong></div><div><span>Received</span><strong>{dateOf(row.created_at)}</strong></div></div><div className="mr-card-bottom"><code>#{String(row.id || '').slice(0, 12)}</code><button type="button" className="mr-view" onClick={() => viewRequest(row)} aria-label={`View request for ${row.name || 'customer'}`}>View request <RequestIcon name="arrow" /></button></div></article>)}</div>
            <div className="mr-pagination"><span>Showing <strong>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong></span><div><label>Rows <select aria-label="Requests per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className="mr-page-controls"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><RequestIcon name="left" /></button><span>{currentPage} / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><RequestIcon name="right" /></button></div></div></div>
          </>}
        </section>
        <footer className="mr-footer"><span>V1Garments customer care</span><span>Mobile orders are available in <a href="/sales">Sales</a> · Returns and cancellations in <a href="/order-issues">Order operations</a></span></footer>
      </div>
    </main>
    <dialog ref={dialogRef} className="mr-dialog" aria-labelledby="mr-dialog-title" onCancel={() => setSelected(null)} onClick={closeFromBackdrop}>
      {selected && <><div className="mr-dialog-header"><div><span className="mr-eyebrow">CUSTOMER REQUEST</span><h2 id="mr-dialog-title">{requestLabel(selected)}</h2></div><button type="button" className="mr-dialog-close" aria-label="Close request details" onClick={() => setSelected(null)}><RequestIcon name="close" /></button></div><div className="mr-dialog-body"><div className="mr-dialog-customer"><Customer row={selected} /><StatusBadge row={selected} /></div><dl className="mr-detail-grid"><div><dt>Customer ID</dt><dd>{selected.user_id ?? 'Not available'}</dd></div><div><dt>Received</dt><dd>{dateOf(selected.created_at)}</dd></div><div className="mr-detail-full"><dt>Email</dt><dd>{selected.email || 'Not available'}</dd></div><div className="mr-detail-full"><dt>Full reference</dt><dd><code>{selected.id}</code></dd></div></dl><button type="button" className="mr-button mr-button-secondary" disabled={!selected.id} onClick={() => copyReference(selected.id)}><RequestIcon name="copy" />Copy reference</button>{copyMessage && <p className="mr-copy-message" role="status">{copyMessage}</p>}<div className="mr-dialog-note"><RequestIcon name="shield" /><p>Verify the customer's ownership before processing this request through your store's account deletion procedure.</p></div></div><div className="mr-dialog-footer"><span>Status reflects the saved request.</span><button type="button" className="mr-button mr-button-primary" onClick={() => setSelected(null)}>Done</button></div></>}
    </dialog>
  </>
}
