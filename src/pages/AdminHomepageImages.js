import React, { useEffect, useMemo, useRef, useState } from 'react'
import NavbarAdmin from './NavbarAdmin'
import './AdminHomepageImages.css'

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  'https://vandhana-shopping-mall-backend.vercel.app'

const STOREFRONT_POSTER_BASE = String(
  process.env.REACT_APP_STOREFRONT_POSTER_BASE_URL || ''
).replace(/\/+$/, '')

const MAX_FILE_SIZE_BYTES = 3.5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]

const PAGE_CONFIG = {
  men: {
    key: 'men',
    label: 'Men',
    sections: [
      {
        key: 'hero',
        label: 'Hero Posters',
        description: 'Top poster carousel shown first on the Men page.',
        layout: 'hero',
        slots: [
          {
            id: 'men.hero.1',
            title: 'Hero Poster 1',
            sourceAsset: 'hero-poster-1.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Men'
          },
          {
            id: 'men.hero.2',
            title: 'Hero Poster 2',
            sourceAsset: 'hero-poster-2.jpeg',
            altText: 'Jeans Collection',
            link: '/collections?gender=Men&category_id=6'
          },
          {
            id: 'men.hero.3',
            title: 'Hero Poster 3',
            sourceAsset: 'hero-poster-3.jpeg',
            altText: 'Oversized Tees Offer',
            link: '/collections?gender=Men&category_id=111'
          },
          {
            id: 'men.hero.4',
            title: 'Hero Poster 4',
            sourceAsset: 'hero-poster-6.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Men'
          },
          {
            id: 'men.hero.5',
            title: 'Hero Poster 5',
            sourceAsset: 'hero-poster-4.jpeg',
            altText: 'Jeans Collection',
            link: '/collections?gender=Men&category_id=6'
          },
          {
            id: 'men.hero.6',
            title: 'Hero Poster 6',
            sourceAsset: 'hero-poster-5.jpeg',
            altText: 'Oversized Tees Offer',
            link: '/collections?gender=Men&category_id=111'
          }
        ]
      },
      {
        key: 'offer',
        label: 'Latest Offers',
        description: 'Wide offer banners shown in the Latest Offers section.',
        layout: 'offer',
        slots: [
          {
            id: 'men.offer.1',
            title: 'Offer Poster 1',
            sourceAsset: 'offers-poster-3.jpeg',
            altText: 'Men Latest Offer 1',
            link: '/collections?gender=Men'
          },
          {
            id: 'men.offer.2',
            title: 'Offer Poster 2',
            sourceAsset: 'offers-poster-4.jpeg',
            altText: 'Men Latest Offer 2',
            link: '/collections?gender=Men'
          },
          {
            id: 'men.offer.3',
            title: 'Offer Poster 3',
            sourceAsset: 'offers-poster-2.jpeg',
            altText: 'Men Latest Offer 3',
            link: '/collections?gender=Men'
          },
          {
            id: 'men.offer.4',
            title: 'Offer Poster 4',
            sourceAsset: 'offers-poster-1.jpeg',
            altText: 'Men Latest Offer 4',
            link: '/collections?gender=Men'
          }
        ]
      }
    ]
  },
  women: {
    key: 'women',
    label: 'Women',
    sections: [
      {
        key: 'hero',
        label: 'Hero Posters',
        description: 'Top poster carousel shown first on the Women page.',
        layout: 'hero',
        slots: [
          {
            id: 'women.hero.1',
            title: 'Hero Poster 1',
            sourceAsset: 'hero-poster-7.jpeg',
            altText: 'Oversized Tees Offer',
            link: '/collections?gender=Women&category_id=128'
          },
          {
            id: 'women.hero.2',
            title: 'Hero Poster 2',
            sourceAsset: 'hero-poster-8.jpeg',
            altText: 'Oversized Tees Offer',
            link: '/collections?gender=Women&category_id=128'
          },
          {
            id: 'women.hero.3',
            title: 'Hero Poster 3',
            sourceAsset: 'hero-poster-3.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Women'
          },
          {
            id: 'women.hero.4',
            title: 'Hero Poster 4',
            sourceAsset: 'hero-poster-9.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Women'
          },
          {
            id: 'women.hero.5',
            title: 'Hero Poster 5',
            sourceAsset: 'hero-poster-6.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Women'
          }
        ]
      },
      {
        key: 'offer',
        label: 'Latest Offers',
        description: 'Wide offer banners shown in the Latest Offers section.',
        layout: 'offer',
        slots: [
          {
            id: 'women.offer.1',
            title: 'Offer Poster 1',
            sourceAsset: 'offers-poster-5.jpeg',
            altText: 'Women Latest Offer 1',
            link: '/collections?gender=Women'
          },
          {
            id: 'women.offer.2',
            title: 'Offer Poster 2',
            sourceAsset: 'offers-poster-6.jpeg',
            altText: 'Women Latest Offer 2',
            link: '/collections?gender=Women'
          }
        ]
      }
    ]
  },
  kids: {
    key: 'kids',
    label: 'Kids',
    sections: [
      {
        key: 'hero',
        label: 'Hero Posters',
        description: 'Top poster carousel shown first on the Kids page.',
        layout: 'hero',
        slots: [
          {
            id: 'kids.hero.1',
            title: 'Hero Poster 1',
            sourceAsset: 'hero-poster-14.jpeg',
            altText: 'Kids Collection',
            link: '/collections?gender=Kids'
          },
          {
            id: 'kids.hero.2',
            title: 'Hero Poster 2',
            sourceAsset: 'hero-poster-10.jpeg',
            altText: 'Anniversary Bash Sale',
            link: '/collections?gender=Kids'
          },
          {
            id: 'kids.hero.3',
            title: 'Hero Poster 3',
            sourceAsset: 'hero-poster-11.jpeg',
            altText: 'Jeans Collection',
            link: '/collections?gender=Kids&category_id=27'
          },
          {
            id: 'kids.hero.4',
            title: 'Hero Poster 4',
            sourceAsset: 'hero-poster-12.jpeg',
            altText: 'Kids Wear',
            link: '/collections?gender=Kids'
          },
          {
            id: 'kids.hero.5',
            title: 'Hero Poster 5',
            sourceAsset: 'hero-poster-13.jpeg',
            altText: 'Kids Fashion',
            link: '/collections?gender=Kids'
          }
        ]
      }
    ]
  }
}

const getStoredToken = () =>
  localStorage.getItem('auth_token') ||
  sessionStorage.getItem('auth_token') ||
  localStorage.getItem('token') ||
  sessionStorage.getItem('token') ||
  ''

const getSourcePreviewUrl = sourceAsset => {
  if (!STOREFRONT_POSTER_BASE) return ''
  return `${STOREFRONT_POSTER_BASE}/${sourceAsset}`
}

const formatDate = value => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const readResponse = async response => {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    )

    error.status = response.status
    error.payload = data

    throw error
  }

  return data
}

const PosterCard = ({
  pageKey,
  section,
  slot,
  slotOrder,
  record,
  onUpdated
}) => {
  const inputRef = useRef(null)

  const [uploading, setUploading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [restoringId, setRestoringId] = useState(null)
  const [error, setError] = useState('')

  const sourcePreviewUrl = getSourcePreviewUrl(slot.sourceAsset)

  const currentImage =
    record?.imageUrl ||
    record?.defaultImageUrl ||
    sourcePreviewUrl ||
    ''

  const handleReplaceClick = () => {
    if (uploading) return
    inputRef.current?.click()
  }

  const handleFileChange = async event => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Please upload JPG, PNG, WEBP or AVIF image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be smaller than 3.5 MB.')
      event.target.value = ''
      return
    }

    setUploading(true)
    setError('')

    try {
      const token = getStoredToken()

      const formData = new FormData()

      formData.append('image', file)
      formData.append('page', pageKey)
      formData.append('section', section.key)
      formData.append('slotOrder', String(slotOrder))
      formData.append('altText', slot.altText || '')
      formData.append('link', slot.link || '')

      if (sourcePreviewUrl) {
        formData.append('defaultImageUrl', sourcePreviewUrl)
      }

      formData.append(
        'extra',
        JSON.stringify({
          sourceAsset: slot.sourceAsset,
          title: slot.title,
          layout: section.layout
        })
      )

      const response = await fetch(
        `${API_BASE}/api/homepage-images/${encodeURIComponent(slot.id)}/replace`,
        {
          method: 'POST',
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {},
          body: formData
        }
      )

      const updated = await readResponse(response)

      onUpdated(updated)

      if (historyOpen) {
        await loadHistory()
      }
    } catch (err) {
      setError(
        err?.message ||
          'Unable to replace poster.'
      )
    } finally {
      setUploading(false)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    setError('')

    try {
      const token = getStoredToken()

      const response = await fetch(
        `${API_BASE}/api/homepage-images/${encodeURIComponent(slot.id)}/history`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {}
        }
      )

      const data = await readResponse(response)

      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      setHistory([])
      setError(
        err?.message ||
          'Unable to load previous images.'
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleHistoryToggle = async () => {
    const next = !historyOpen

    setHistoryOpen(next)

    if (next) {
      await loadHistory()
    }
  }

  const handleRestore = async historyItem => {
    if (!historyItem?.id || restoringId) return

    setRestoringId(historyItem.id)
    setError('')

    try {
      const token = getStoredToken()

      const response = await fetch(
        `${API_BASE}/api/homepage-images/${encodeURIComponent(slot.id)}/history/${encodeURIComponent(historyItem.id)}/restore`,
        {
          method: 'POST',
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {}
        }
      )

      const updated = await readResponse(response)

      onUpdated(updated)

      await loadHistory()
    } catch (err) {
      setError(
        err?.message ||
          'Unable to restore previous poster.'
      )
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <article className={`poster-manager-card ${section.layout === 'offer' ? 'poster-manager-card-offer' : 'poster-manager-card-hero'}`}>
      <div className="poster-manager-card-top">
        <div>
          <span className="poster-manager-slot-number">{String(slotOrder).padStart(2, '0')}</span>
          <h3>{slot.title}</h3>
        </div>
        <span className="poster-manager-current-badge">{record?.imageUrl ? 'CUSTOM' : 'WEBSITE CURRENT'}</span>
      </div>

      <div className={`poster-manager-preview ${section.layout === 'offer' ? 'poster-manager-preview-offer' : 'poster-manager-preview-hero'}`}>
        {currentImage ? (
          <img src={currentImage} alt={record?.altText || slot.altText || slot.title} />
        ) : (
          <div className="poster-manager-source-placeholder">
            <span>Current Website Poster</span>
            <strong>{slot.sourceAsset}</strong>
          </div>
        )}

        {uploading ? (
          <div className="poster-manager-upload-overlay">
            <div className="poster-manager-spinner" />
            <span>Uploading</span>
          </div>
        ) : null}
      </div>

      <div className="poster-manager-card-info">
        <div className="poster-manager-file-row">
          <span>Website file</span>
          <strong>{slot.sourceAsset}</strong>
        </div>

        <div className="poster-manager-file-row">
          <span>Slot ID</span>
          <strong>{slot.id}</strong>
        </div>

        {record?.updatedAt ? (
          <div className="poster-manager-file-row">
            <span>Last updated</span>
            <strong>{formatDate(record.updatedAt)}</strong>
          </div>
        ) : null}
      </div>

      {error ? <div className="poster-manager-error">{error}</div> : null}

      <div className="poster-manager-actions">
        <button type="button" className="poster-manager-replace-btn" onClick={handleReplaceClick} disabled={uploading}>{uploading ? 'Uploading...' : 'Replace Image'}</button>
        <button type="button" className={`poster-manager-history-btn ${historyOpen ? 'active' : ''}`} onClick={handleHistoryToggle}>{historyOpen ? 'Hide Previous' : 'Previous Images'}</button>
      </div>

      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" onChange={handleFileChange} className="poster-manager-file-input" />

      {historyOpen ? (
        <div className="poster-manager-history">
          <div className="poster-manager-history-head">
            <h4>Previous Images</h4>
            <span>{history.length}</span>
          </div>

          {historyLoading ? (
            <div className="poster-manager-history-loading">
              <div className="poster-manager-small-spinner" />
              <span>Loading previous images...</span>
            </div>
          ) : history.length ? (
            <div className="poster-manager-history-grid">
              {history.map(item => (
                <div className="poster-manager-history-item" key={item.id}>
                  <div className={`poster-manager-history-image ${section.layout === 'offer' ? 'offer' : 'hero'}`}>
                    <img src={item.imageUrl} alt={item.altText || slot.title} loading="lazy" />
                  </div>
                  <div className="poster-manager-history-meta">
                    <span>{formatDate(item.createdAt)}</span>
                    <strong>{item.changeType || 'REPLACE'}</strong>
                  </div>
                  <button type="button" className="poster-manager-restore-btn" onClick={() => handleRestore(item)} disabled={Boolean(restoringId)}>{restoringId === item.id ? 'Restoring...' : 'Restore'}</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="poster-manager-empty-history">No previous images yet.</div>
          )}
        </div>
      ) : null}
    </article>
  )
}

export default function AdminHomepageImages() {
  const [activePage, setActivePage] = useState('men')
  const [remoteMap, setRemoteMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const currentPage = PAGE_CONFIG[activePage]

  const allSlots = useMemo(
    () =>
      Object.values(PAGE_CONFIG).flatMap(page =>
        page.sections.flatMap(section =>
          section.slots.map((slot, index) => ({
            ...slot,
            page: page.key,
            section: section.key,
            slotOrder: index + 1
          }))
        )
      ),
    []
  )

  const totalSlots = allSlots.length

  const customCount = useMemo(
    () =>
      allSlots.filter(slot => Boolean(remoteMap[slot.id]?.imageUrl)).length,
    [allSlots, remoteMap]
  )

  const loadImages = async () => {
    setLoading(true)
    setPageError('')

    try {
      const response = await fetch(
        `${API_BASE}/api/homepage-images`,
        {
          method: 'GET',
          cache: 'no-store'
        }
      )

      const data = await readResponse(response)

      const nextMap = {}

      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item?.id) {
            nextMap[item.id] = item
          }
        })
      }

      setRemoteMap(nextMap)
    } catch (err) {
      setRemoteMap({})
      setPageError(
        err?.message ||
          'Unable to load poster mappings.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadImages()
  }, [])

  const handleUpdated = updated => {
    if (!updated?.id) return

    setRemoteMap(previous => ({
      ...previous,
      [updated.id]: updated
    }))
  }

  return (
    <>
      <NavbarAdmin />

      <main className="poster-manager-page">
        <div className="poster-manager-shell">
          <header className="poster-manager-header">
            <div>
              <span className="poster-manager-eyebrow">Website Content</span>
              <h1>Website Poster Manager</h1>
              <p>Manage the exact hero and offer poster positions used by the Men, Women and Kids pages.</p>
            </div>

            <button type="button" className="poster-manager-refresh-btn" onClick={loadImages} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          </header>

          <div className="poster-manager-summary">
            <div className="poster-manager-summary-card">
              <span>Total Website Slots</span>
              <strong>{totalSlots}</strong>
            </div>

            <div className="poster-manager-summary-card">
              <span>Custom Posters</span>
              <strong>{customCount}</strong>
            </div>

            <div className="poster-manager-summary-card">
              <span>Original Posters</span>
              <strong>{totalSlots - customCount}</strong>
            </div>
          </div>

          {pageError ? <div className="poster-manager-page-error">{pageError}</div> : null}

          <div className="poster-manager-page-tabs">
            {Object.values(PAGE_CONFIG).map(page => (
              <button type="button" key={page.key} className={`poster-manager-page-tab ${activePage === page.key ? 'active' : ''}`} onClick={() => setActivePage(page.key)}>
                <span>{page.label}</span>
                <small>{page.sections.reduce((sum, section) => sum + section.slots.length, 0)} posters</small>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="poster-manager-loading">
              <div className="poster-manager-spinner-large" />
              <h2>Loading website posters</h2>
              <p>Reading the latest poster mappings from the backend.</p>
            </div>
          ) : (
            <div className="poster-manager-content">
              <div className="poster-manager-page-heading">
                <span>{currentPage.label.toUpperCase()} PAGE</span>
                <h2>{currentPage.label} Website Posters</h2>
              </div>

              {currentPage.sections.map(section => (
                <section className="poster-manager-section" key={`${currentPage.key}-${section.key}`}>
                  <div className="poster-manager-section-head">
                    <div>
                      <span className="poster-manager-section-type">{section.key === 'hero' ? 'TOP OF PAGE' : 'LATEST OFFERS'}</span>
                      <h2>{section.label}</h2>
                      <p>{section.description}</p>
                    </div>

                    <strong>{section.slots.length} posters</strong>
                  </div>

                  <div className={`poster-manager-grid poster-manager-grid-${section.layout}`}>
                    {section.slots.map((slot, index) => (
                      <PosterCard
                        key={slot.id}
                        pageKey={currentPage.key}
                        section={section}
                        slot={slot}
                        slotOrder={index + 1}
                        record={remoteMap[slot.id]}
                        onUpdated={handleUpdated}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}