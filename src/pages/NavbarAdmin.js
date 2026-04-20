import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './NavbarAdmin.css'

const NavbarAdmin = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const location = useLocation()
  const mobileNavRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = event => {
      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(event.target) &&
        !event.target.closest('.nav-toggle-final')
      ) {
        setIsMobileNavOpen(false)
      }
    }

    if (isMobileNavOpen) {
      document.addEventListener('click', handleOutsideClick)
    }

    return () => document.removeEventListener('click', handleOutsideClick)
  }, [isMobileNavOpen])

  const handleNavClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsMobileNavOpen(false)
  }

  const navLinks = [
    { name: 'Products', path: '/' },
    { name: 'Transactions', path: '/transactions' },
    { name: 'Stocks', path: '/stocks' },
    { name: 'Sales', path: '/sales' },
    { name: 'B2B Orders', path: '/b2b-orders' },
    { name: 'Customers', path: '/customers' },
    { name: 'POS', path: '/pos' },
    { name: 'Import', path: '/import' },
    { name: 'Homepage Images', path: '/homepage-images' },
    { name: 'Cancellations', path: '/order-issues' }
  ]

  return (
    <nav className="navbar-final">
      <div className="top-row-final">
        <div className="logo-final">
          <video autoPlay loop muted playsInline>
            <source src="/images/logo.mp4" type="video/mp4" />
          </video>
        </div>

        <div
          className="nav-toggle-final"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        >
          <div className="dot-grid-final">
            {[...Array(9)].map((_, i) => (
              <span key={i}></span>
            ))}
          </div>
        </div>

        <div className="nav-right-final desktop-tab-only-final">
          <div className="nav-links-final">
            {navLinks.map(({ name, path }) => (
              <Link
                key={name}
                to={path}
                onClick={handleNavClick}
                className={`nav-link-final ${location.pathname === path ? 'active-final' : ''}`}
              >
                <span>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {isMobileNavOpen && (
        <div className="mobile-drawer-final" ref={mobileNavRef}>
          <div
            className="close-btn-final"
            onClick={() => setIsMobileNavOpen(false)}
          >
            ×
          </div>
          <div className="nav-links-final">
            {navLinks.map(({ name, path }) => (
              <Link
                key={name}
                to={path}
                onClick={handleNavClick}
                className={`nav-link-final ${location.pathname === path ? 'active-final' : ''}`}
              >
                <span>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

export default NavbarAdmin