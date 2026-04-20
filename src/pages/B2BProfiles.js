import React, { useState, useEffect, useRef, useMemo } from 'react'
import './B2BProfiles.css'

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app'
const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE
const API_BASE = API_BASE_RAW.replace(/\/+$/, '')

const B2BProfiles = () => {
  const [b2bCustomers, setB2bCustomers] = useState([])
  const [showPopup, setShowPopup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [city, setCity] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [popupMessage, setPopupMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const popupRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/b2b-customers`)
      .then((res) => res.json())
      .then((data) => setB2bCustomers(Array.isArray(data) ? data : []))
      .catch(() => setB2bCustomers([]))
      .finally(() => setLoading(false))
  }, [])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return b2bCustomers
    return b2bCustomers.filter((customer) =>
      [customer.name, customer.email, customer.mobile, customer.city]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [b2bCustomers, search])

  const handleAddCustomer = async () => {
    if (!name || !email || !mobile || !password || !confirmPassword) return
    if (password !== confirmPassword) {
      setPopupMessage('Passwords do not match')
      setTimeout(() => setPopupMessage(''), 2000)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/b2b-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, city, password })
      })
      const data = await res.json()
      if (res.ok) {
        setB2bCustomers((prev) => [...prev, data.user])
        setPopupMessage('Successfully added the new customer')
        setShowPopup(false)
        setName('')
        setEmail('')
        setMobile('')
        setCity('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => setPopupMessage(''), 2000)
      } else {
        setPopupMessage(data.message || 'Error adding customer')
        setTimeout(() => setPopupMessage(''), 2000)
      }
    } catch {
      setPopupMessage('Server error')
      setTimeout(() => setPopupMessage(''), 2000)
    }
  }

  const handleClickOutside = (e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) setShowPopup(false)
  }

  useEffect(() => {
    if (showPopup) document.addEventListener('mousedown', handleClickOutside)
    else document.removeEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPopup])

  return (
    <div className="b2b-container-b2b-vanadana">
      <div className="b2b-topbar-b2b-vanadana">
        <div className="b2b-heading-wrap-b2b-vanadana">
          <span className="b2b-badge-b2b-vanadana">Business Customers</span>
          <h2 className="heading-b2b-vanadana">B2B Profiles</h2>
          <p className="b2b-subtitle-b2b-vanadana">Manage wholesale customers, review contact details, and add new business accounts from one clean dashboard.</p>
        </div>

        <div className="b2b-stats-card-b2b-vanadana">
          <span className="b2b-stats-label-b2b-vanadana">Total Customers</span>
          <span className="b2b-stats-value-b2b-vanadana">{b2bCustomers.length}</span>
        </div>
      </div>

      <div className="b2b-toolbar-b2b-vanadana">
        <div className="b2b-search-wrap-b2b-vanadana">
          <span className="b2b-search-icon-b2b-vanadana" />
          <input
            className="b2b-search-input-b2b-vanadana"
            type="text"
            placeholder="Search by name, email, mobile or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="add-btn-b2b-vanadana" onClick={() => setShowPopup(true)}>
          Add New Customer
        </button>
      </div>

      <div className="table-wrap-b2b-vanadana">
        <div className="b2b-table-headline-b2b-vanadana">
          <h3 className="b2b-table-title-b2b-vanadana">Customer Directory</h3>
          <span className="b2b-table-count-b2b-vanadana">
            {loading ? 'Loading...' : `${filteredCustomers.length} record${filteredCustomers.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="b2b-table-scroll-b2b-vanadana">
          <table className="customers-table-b2b-vanadana">
            <thead>
              <tr>
                <th className="table-th-b2b-vanadana">Name</th>
                <th className="table-th-b2b-vanadana">Email</th>
                <th className="table-th-b2b-vanadana">Mobile</th>
                <th className="table-th-b2b-vanadana">City</th>
                <th className="table-th-b2b-vanadana">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="table-td-b2b-vanadana empty-b2b-vanadana" colSpan="5">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="table-row-b2b-vanadana">
                    <td className="table-td-b2b-vanadana">
                      <div className="customer-main-b2b-vanadana">
                        <span className="customer-name-b2b-vanadana">{customer.name}</span>
                      </div>
                    </td>
                    <td className="table-td-b2b-vanadana">
                      <span className="customer-sub-b2b-vanadana">{customer.email}</span>
                    </td>
                    <td className="table-td-b2b-vanadana">
                      <span className="customer-sub-b2b-vanadana">{customer.mobile}</span>
                    </td>
                    <td className="table-td-b2b-vanadana">
                      <span className="city-pill-b2b-vanadana">{customer.city || '-'}</span>
                    </td>
                    <td className="table-td-b2b-vanadana">
                      <div className="actions-wrap-b2b-vanadana">
                        <button className="action-btn-b2b-vanadana">Change Password</button>
                        <button className="delete-btn-b2b-vanadana">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-td-b2b-vanadana empty-b2b-vanadana" colSpan="5">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPopup && (
        <div className="popup-overlay-b2b-vanadana">
          <div className="popup-box-b2b-vanadana" ref={popupRef}>
            <div className="popup-close-b2b-vanadana" onClick={() => setShowPopup(false)}>
              ×
            </div>

            <div className="popup-head-b2b-vanadana">
              <span className="popup-badge-b2b-vanadana">New Account</span>
              <h3 className="popup-title-b2b-vanadana">Add B2B Customer</h3>
              <p className="popup-subtitle-b2b-vanadana">Create a new wholesale customer profile with contact and city details.</p>
            </div>

            <div className="popup-grid-b2b-vanadana">
              <input
                className="popup-input-b2b-vanadana"
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="popup-input-b2b-vanadana"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="popup-input-b2b-vanadana"
                type="tel"
                placeholder="Mobile Number"
                maxLength="10"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
              <input
                className="popup-input-b2b-vanadana"
                type="text"
                placeholder="City / Location"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <input
                className="popup-input-b2b-vanadana"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="popup-input-b2b-vanadana"
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button className="submit-btn-b2b-vanadana" onClick={handleAddCustomer}>
              Submit
            </button>
          </div>
        </div>
      )}

      {popupMessage && <div className="popup-success-b2b-vanadana">{popupMessage}</div>}
    </div>
  )
}

export default B2BProfiles