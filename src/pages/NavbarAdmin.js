import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from './AdminAuth'
import './NavbarAdmin.css'

const NavbarAdmin = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const location = useLocation()
  const mobileNavRef = useRef(null)
  const { user } = useAuth()

  const role = String(
    user?.role ||
    user?.role_enum ||
    ''
  )
    .trim()
    .toUpperCase()

  const isSuperAdmin = role === 'SUPER_ADMIN'

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
      document.addEventListener(
        'click',
        handleOutsideClick
      )
    }

    return () => {
      document.removeEventListener(
        'click',
        handleOutsideClick
      )
    }
  }, [isMobileNavOpen])

  const handleNavClick = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })

    setIsMobileNavOpen(false)
  }

  const navLinks = [
    {
      name: 'Products',
      path: '/'
    },
    {
      name: 'Transactions',
      path: '/transactions'
    },
    {
      name: 'Stocks',
      path: '/stocks'
    },
    {
      name: 'Sales',
      path: '/sales'
    },
    {
      name: 'B2B Orders',
      path: '/b2b-orders'
    },
    {
      name: 'Customers',
      path: '/customers'
    },
    {
      name: 'POS',
      path: '/pos'
    },
    {
      name: 'Import',
      path: '/import'
    },
    ...(
      isSuperAdmin
        ? [
            {
              name: 'Categories',
              path: '/categories'
            }
          ]
        : []
    ),
    {
      name: 'Cancellations',
      path: '/order-issues'
    }
  ]

  const isActivePath = path => {
    if (path === '/') {
      return location.pathname === '/'
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    )
  }

  const renderLinks = () => (
    <div className="nav-links-final">
      {navLinks.map(({ name, path }) => (
        <Link
          key={name}
          to={path}
          onClick={handleNavClick}
          className={`nav-link-final ${
            isActivePath(path)
              ? 'active-final'
              : ''
          }`}
        >
          <span>{name}</span>
        </Link>
      ))}
    </div>
  )

  return (
    <nav className="navbar-final">
      <div className="top-row-final">
        <div className="nav-right-final desktop-tab-only-final">
          {renderLinks()}
        </div>

        <button
          type="button"
          className="nav-toggle-final"
          onClick={() =>
            setIsMobileNavOpen(
              current => !current
            )
          }
          aria-label="Toggle navigation"
          aria-expanded={isMobileNavOpen}
        >
          <div className="dot-grid-final">
            {[...Array(9)].map((_, index) => (
              <span key={index}></span>
            ))}
          </div>
        </button>
      </div>

      {isMobileNavOpen && (
        <div
          className="mobile-drawer-final"
          ref={mobileNavRef}
        >
          <button
            type="button"
            className="close-btn-final"
            onClick={() =>
              setIsMobileNavOpen(false)
            }
            aria-label="Close navigation"
          >
            ×
          </button>

          {renderLinks()}
        </div>
      )}
    </nav>
  )
}

export default NavbarAdmin