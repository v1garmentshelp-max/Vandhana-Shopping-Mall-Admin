import React, { useCallback, useEffect, useState } from 'react'
import NavbarAdmin from './NavbarAdmin'
import { apiGet } from './api'
import './MobileRequests.css'

export default function MobileRequests() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const load = useCallback(async signal => {
    setBusy(true)
    setError('')
    try {
      const data = await apiGet('/mobile/admin/account-requests', {}, { signal })
      if (!signal?.aborted) setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      if (!signal?.aborted) setError(err.message || 'Requests could not be loaded.')
    } finally {
      if (!signal?.aborted) setBusy(false)
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])
  return <>
    <NavbarAdmin />
    <main className="mobile-requests">
      <header>
        <div><p className="mobile-requests-kicker">CUSTOMER CARE</p><h1>Mobile account requests</h1></div>
        <button type="button" onClick={() => load()} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button>
      </header>
      <p>Customers can request account deletion from the app. Verify ownership and process each request through your store's account deletion procedure. A recorded request does not delete the account.</p>
      {error && <p role="alert" className="mobile-requests-error">{error}</p>}
      {!busy && !error && rows.length === 0 && <p className="mobile-requests-empty">No requests have been submitted.</p>}
      {rows.length > 0 && <div className="mobile-requests-table" role="region" aria-label="Account requests" tabIndex={0}>
        <table><thead><tr><th>Customer</th><th>Email</th><th>Request</th><th>Status</th><th>Received</th><th>Reference</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td>{row.name}<small>Customer {row.user_id}</small></td>
            <td>{row.email}</td><td>Account deletion</td><td><span>{row.status}</span></td>
            <td>{new Date(row.created_at).toLocaleString()}</td><td><code>{row.id}</code></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mobile-requests-note">Latest 200 requests. Mobile orders appear in Sales; inventory, catalogue, returns, and rewards use your existing admin sections.</p>
    </main>
  </>
}
