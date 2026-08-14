import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from './AdminAuth'
import './NavbarAdmin.css'

const NavbarAdmin = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const location = useLocation()
  const mobileNavRef = useRef(null)
  const { user } = useAuth()

  const role = String(user?.role || user?.role_enum || '').trim().toUpperCase()
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const navLinks = useMemo(() => [
    { name: 'Products', path: '/' },
    { name: 'Transactions', path: '/transactions' },
    { name: 'Stocks', path: '/stocks' },
    { name: 'Sales', path: '/sales' },
    { name: 'Customers', path: '/customers' },
    { name: 'POS', path: '/pos' },
    { name: 'Import', path: '/import' },
    { name: 'Rewards', path: '/rewards' },
    ...(isSuperAdmin ? [
      { name: 'Categories', path: '/categories' },
      { name: 'Design Review', path: '/product-design-review' }
    ] : []),
    { name: 'Homepage Images', path: '/homepage-images' },
    { name: 'Cancellations', path: '/order-issues' }
  ], [isSuperAdmin])

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleOutsideClick = event => {
      const target = event.target

      if (
        isMobileNavOpen &&
        target instanceof Element &&
        mobileNavRef.current &&
        !mobileNavRef.current.contains(target) &&
        !target.closest('.nav-toggle-final')
      ) {
        setIsMobileNavOpen(false)
      }
    }

    const handleEscape = event => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileNavOpen])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    if (isMobileNavOpen) document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavOpen])

  const handleNavClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsMobileNavOpen(false)
  }

  const isActivePath = path => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const renderLinks = mobile => (
    <div className={`nav-links-final ${mobile ? 'mobile-nav-links-final' : 'desktop-nav-links-final'}`}>
      {navLinks.map(({ name, path }) => <Link key={path} to={path} onClick={handleNavClick} className={`nav-link-final ${isActivePath(path) ? 'active-final' : ''}`}><span>{name}</span></Link>)}
    </div>
  )

  return (
    <>
      <nav className="navbar-final">
        <div className="top-row-final">
          <Link to="/" className="logo-final" onClick={handleNavClick} aria-label="Admin home"><img src="/images/main.svg" alt="Vandhana Shopping Mall" /></Link>

          <div className="nav-center-final desktop-tab-only-final">
            <div className="nav-scroll-final">{renderLinks(false)}</div>
          </div>

          <div className="nav-actions-final">
            <button type="button" className={`nav-toggle-final ${isMobileNavOpen ? 'nav-toggle-open-final' : ''}`} onClick={() => setIsMobileNavOpen(current => !current)} aria-label="Toggle navigation" aria-expanded={isMobileNavOpen}><span className="dot-grid-final">{Array.from({ length: 9 }).map((_, index) => <span key={index} />)}</span></button>
          </div>
        </div>
      </nav>

      {isMobileNavOpen ? <button type="button" className="mobile-overlay-final" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation" /> : null}

      <aside ref={mobileNavRef} className={`mobile-drawer-final ${isMobileNavOpen ? 'mobile-drawer-open-final' : ''}`} aria-hidden={!isMobileNavOpen}>
        <div className="mobile-drawer-header-final">
          <Link to="/" className="mobile-logo-final" onClick={handleNavClick} aria-label="Admin home"><img src="/images/main.svg" alt="Vandhana Shopping Mall" /></Link>
          <button type="button" className="close-btn-final" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation">×</button>
        </div>

        <div className="mobile-drawer-content-final">{renderLinks(true)}</div>

        <div className="mobile-drawer-footer-final">
          <span>{user?.username || user?.email || 'Admin'}</span>
          <strong>{role || 'ADMIN'}</strong>
        </div>
      </aside>
    </>
  )
}

export default NavbarAdmin