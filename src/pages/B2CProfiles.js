import React, { useEffect, useMemo, useState } from 'react'
import './B2CProfiles.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')

const B2CProfiles = () => {
  const [b2cCustomers, setB2cCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/b2c-customers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setB2cCustomers(data)
        } else {
          setB2cCustomers([])
        }
      })
      .catch(() => {
        setB2cCustomers([])
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return b2cCustomers
    return b2cCustomers.filter((customer) =>
      [customer.name, customer.email, customer.mobile]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [b2cCustomers, search])

  return (
    <div className="b2c-container-vanadana">
      <div className="b2c-topbar-vanadana">
        <div className="b2c-heading-wrap-vanadana">
          <span className="b2c-badge-vanadana">Retail Customers</span>
          <h2 className="b2c-title-vanadana">B2C Profiles</h2>
          <p className="b2c-subtitle-vanadana">
            View individual customer accounts with a cleaner layout, better spacing, and improved readability.
          </p>
        </div>

        <div className="b2c-stats-card-vanadana">
          <span className="b2c-stats-label-vanadana">Total Customers</span>
          <span className="b2c-stats-value-vanadana">{b2cCustomers.length}</span>
        </div>
      </div>

      <div className="b2c-toolbar-vanadana">
        <div className="b2c-search-wrap-vanadana">
          <span className="b2c-search-icon-vanadana" />
          <input
            className="b2c-search-input-vanadana"
            type="text"
            placeholder="Search by full name, email or mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="b2c-table-wrap-vanadana">
        <div className="b2c-table-headline-vanadana">
          <h3 className="b2c-table-title-vanadana">Customer Directory</h3>
          <span className="b2c-table-count-vanadana">
            {loading ? 'Loading...' : `${filteredCustomers.length} record${filteredCustomers.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="b2c-table-scroll-vanadana">
          <table className="b2c-table-vanadana">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Mobile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="b2c-empty-vanadana">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="b2c-row-vanadana">
                    <td>
                      <div className="b2c-customer-main-vanadana">
                        <span className="b2c-customer-name-vanadana">{customer.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="b2c-customer-sub-vanadana">{customer.email}</span>
                    </td>
                    <td>
                      <span className="b2c-customer-sub-vanadana">{customer.mobile}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="b2c-empty-vanadana">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default B2CProfiles