import React, { useCallback, useEffect, useRef, useState } from 'react'
import NavbarAdmin from './NavbarAdmin'
import { apiGet, apiPut, apiPatch, apiUpload } from './api'
import './MobileStudio.css'

const COLLECTIONS = [{ id: 'men', name: 'Men' }, { id: 'women', name: 'Women' }, { id: 'kids', name: 'Kids' }]
const EMPTY_LAYERS = ['', '', '', '']
const currency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0)
const dateLabel = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not available'
}

function StudioIcon({ name, className = '' }) {
  const paths = {
    refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6.1 7a7 7 0 0 1 11.6-2L20 8', 'M4 16l2.3 3A7 7 0 0 0 17.9 17'],
    check: ['M5 12l4 4L19 6'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v4h16v-4'],
    image: ['M4 4h16v16H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M8 8h.01'],
    shirt: ['M8 3l-5 4 3 5 2-1v10h8V11l2 1 3-5-5-4', 'M8 3a4 4 0 0 0 8 0'],
    palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3-4-5-9-5', 'M7 9h.01', 'M10 6h.01', 'M15 6h.01'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    shield: ['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z', 'M8 12l3 3 5-6'],
    clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l3 2'],
    plus: ['M12 5v14', 'M5 12h14']
  }
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] || paths.image).map((path, index) => <path key={index} d={path} />)}</svg>
}

function normaliseConfig(value) {
  const customizer = value?.customizer
  if (!customizer || !Array.isArray(customizer.garments) || !Array.isArray(customizer.sizes) || !Array.isArray(customizer.colors)) throw new Error('Store settings could not be read. Reload to try again.')
  return {
    ...value,
    support: { ...value.support, email: String(value.support?.email || '') },
    customizer: {
      ...customizer,
      enabled: Boolean(customizer.enabled),
      garments: customizer.garments.map(garment => ({ ...garment, enabled: Boolean(garment.enabled) })),
      sizes: [...customizer.sizes],
      colors: customizer.colors.map(color => ({ name: String(color.name || ''), code: String(color.code || '#000000') }))
    }
  }
}

function fingerprint(config, sizes) {
  return JSON.stringify({ customizer: config?.customizer, support: config?.support, sizes })
}

function validateSettings(config, sizeText) {
  const issues = {}
  const customizer = config.customizer
  const sizes = [...new Set(sizeText.split(',').map(size => size.trim()).filter(Boolean))]
  if (customizer.garments.length !== 3) issues.garments = 'The store must have its three supported garment styles.'
  customizer.garments.forEach((garment, index) => {
    const price = Number(garment.price)
    const mrp = Number(garment.mrp)
    if (!String(garment.name || '').trim()) issues[`name-${index}`] = 'Enter a garment name.'
    if (!Number.isFinite(price) || price <= 0 || price > 100000) issues[`price-${index}`] = 'Enter a price above ₹0 and up to ₹1,00,000.'
    if (!Number.isFinite(mrp) || mrp < price || mrp <= 0 || mrp > 100000) issues[`mrp-${index}`] = 'Original price must be at least the selling price and up to ₹1,00,000.'
  })
  if (!sizes.length || sizes.length > 15 || sizes.some(size => !/^[a-z0-9 -]{1,12}$/i.test(size))) issues.sizes = 'Enter 1–15 sizes. Each can contain up to 12 letters, numbers, spaces or hyphens.'
  if (!customizer.colors.length || customizer.colors.length > 24) issues.colors = 'Add between 1 and 24 colours.'
  const colourCodes = new Set()
  customizer.colors.forEach((color, index) => {
    if (!color.name.trim()) issues[`color-name-${index}`] = 'Enter a colour name.'
    if (!/^#[a-f0-9]{6}$/i.test(color.code)) issues[`color-code-${index}`] = 'Use a six-digit hex colour, such as #203A2C.'
    else if (colourCodes.has(color.code.toLowerCase())) issues[`color-code-${index}`] = 'This shade is already in your palette. Choose a different colour.'
    colourCodes.add(color.code.toLowerCase())
  })
  const email = config.support.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.email = 'Enter a valid support email address.'
  return { issues, payload: {
    ...config,
    support: { ...config.support, email },
    customizer: {
      ...customizer,
      sizes,
      garments: customizer.garments.map(garment => ({ ...garment, name: String(garment.name).trim(), price: Number(garment.price), mrp: Number(garment.mrp) })),
      colors: customizer.colors.map(color => ({ name: color.name.trim(), code: color.code.toLowerCase() }))
    }
  } }
}

export default function MobileStudio() {
  const [config, setConfig] = useState(null)
  const [sizeText, setSizeText] = useState('')
  const [baseline, setBaseline] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [issues, setIssues] = useState({})
  const [tab, setTab] = useState('clothing')
  const [collection, setCollection] = useState('men')
  const [layers, setLayers] = useState([...EMPTY_LAYERS])
  const [savedLayers, setSavedLayers] = useState([...EMPTY_LAYERS])
  const [sceneExtra, setSceneExtra] = useState({})
  const [sceneUpdatedAt, setSceneUpdatedAt] = useState(null)
  const [loadedCollection, setLoadedCollection] = useState('')
  const [sceneLoading, setSceneLoading] = useState(true)
  const [sceneError, setSceneError] = useState('')
  const [sceneReload, setSceneReload] = useState(0)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const mounted = useRef(true)
  const lock = useRef(false)
  const settingsController = useRef(null)
  const settingsDirty = Boolean(config && fingerprint(config, sizeText) !== baseline)
  const sceneDirty = JSON.stringify(layers) !== JSON.stringify(savedLayers)
  const collectionName = COLLECTIONS.find(item => item.id === collection)?.name || 'Collection'
  const filledLayers = layers.filter(Boolean).length
  const headerStatus = settingsDirty || sceneDirty ? 'Unsaved changes' : settingsLoading || sceneLoading ? 'Loading settings' : settingsError || sceneError ? 'Check loading errors' : 'Saved settings'
  const sizePreview = [...new Set(sizeText.split(',').map(size => size.trim()).filter(Boolean))]

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      settingsController.current?.abort()
    }
  }, [])

  const loadSettings = useCallback(async () => {
    settingsController.current?.abort()
    const controller = new AbortController()
    settingsController.current = controller
    setSettingsLoading(true)
    setSettingsError('')
    try {
      const next = normaliseConfig(await apiGet('/mobile/store', {}, { signal: controller.signal }))
      if (controller.signal.aborted || !mounted.current) return
      const sizes = next.customizer.sizes.join(', ')
      setConfig(next)
      setSizeText(sizes)
      setBaseline(fingerprint(next, sizes))
      setIssues({})
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) setSettingsError(error.message || 'Settings could not be loaded.')
    } finally {
      if (!controller.signal.aborted && mounted.current) setSettingsLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    const controller = new AbortController()
    setSceneLoading(true)
    setSceneError('')
    setLoadedCollection('')
    setLayers([...EMPTY_LAYERS])
    setSavedLayers([...EMPTY_LAYERS])
    setSceneExtra({})
    setSceneUpdatedAt(null)
    apiGet('/homepage-images', { page: collection, section: 'editorial' }, { signal: controller.signal }).then(rows => {
      if (controller.signal.aborted || !mounted.current) return
      if (!Array.isArray(rows)) throw new Error('Collection artwork could not be read.')
      const scene = rows.find(row => row.id === `mobile-${collection}-editorial`) || rows[0]
      const next = EMPTY_LAYERS.map((_, index) => String(scene?.extra?.layers?.[index] || ''))
      setLayers(next)
      setSavedLayers([...next])
      setSceneExtra(scene?.extra || {})
      setSceneUpdatedAt(scene?.updatedAt || null)
      setLoadedCollection(collection)
    }).catch(error => {
      if (!controller.signal.aborted && mounted.current) setSceneError(error.message || 'Collection artwork could not be loaded.')
    }).finally(() => {
      if (!controller.signal.aborted && mounted.current) setSceneLoading(false)
    })
    return () => controller.abort()
  }, [collection, sceneReload])

  useEffect(() => {
    if (!settingsDirty && !sceneDirty && !busy) return undefined
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    const protectNavigation = event => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!link || link.target === '_blank' || link.hasAttribute('download') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      const destination = new URL(link.href, window.location.href)
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
      if (!window.confirm(busy ? 'An upload or save is still in progress. Leave this page?' : 'You have unsaved studio changes. Leave without saving them?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', protectNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', protectNavigation, true)
    }
  }, [settingsDirty, sceneDirty, busy])

  function changeCustomizer(update) {
    setConfig(current => ({ ...current, customizer: { ...current.customizer, ...update(current.customizer) } }))
    setNotice(null)
    setIssues({})
  }

  function editGarment(index, key, value) {
    changeCustomizer(customizer => ({ garments: customizer.garments.map((garment, position) => position === index ? { ...garment, [key]: value } : garment) }))
  }

  async function runAction(key, action, message) {
    if (lock.current) return
    lock.current = true
    setBusy(key)
    setNotice(null)
    try {
      await action()
      if (mounted.current) setNotice({ type: 'success', text: message })
    } catch (error) {
      if (mounted.current) setNotice({ type: 'error', text: error.message || 'This change could not be saved. Please retry.' })
    } finally {
      lock.current = false
      if (mounted.current) setBusy('')
    }
  }

  function saveSettings(event) {
    event.preventDefault()
    const { issues: nextIssues, payload } = validateSettings(config, sizeText)
    setIssues(nextIssues)
    if (Object.keys(nextIssues).length) {
      setNotice({ type: 'error', text: 'Check the highlighted fields before saving your clothing settings.' })
      return
    }
    runAction('settings', async () => {
      const next = normaliseConfig(await apiPut('/mobile/admin/store', payload))
      if (!mounted.current) return
      const sizes = next.customizer.sizes.join(', ')
      setConfig(next)
      setSizeText(sizes)
      setBaseline(fingerprint(next, sizes))
      setIssues({})
    }, 'Clothing settings saved. These prices and options are now available to customers.')
  }

  function reloadSettings() {
    if (settingsDirty && !window.confirm('Discard unsaved clothing changes and reload the saved settings?')) return
    setNotice(null)
    loadSettings()
  }

  function selectCollection(next) {
    if (next === collection || busy) return
    if (sceneDirty && !window.confirm('Discard unpublished artwork changes and switch collections?')) return
    setNotice(null)
    setCollection(next)
  }

  async function uploadLayer(file, index) {
    if (!file || loadedCollection !== collection) return
    if (!['image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 3.5 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Choose a PNG or WebP image up to 3.5 MB. Use a transparent clothing cutout.' })
      return
    }
    await runAction(`upload-${index}`, async () => {
      const data = new FormData()
      data.append('image', file)
      data.append('page', collection)
      data.append('section', 'editorial-layer')
      data.append('slotOrder', String(index))
      const image = await apiUpload(`/homepage-images/mobile-${collection}-layer-${index}/replace`, data)
      if (!/^https:\/\//i.test(String(image?.imageUrl || ''))) throw new Error('Upload did not return a secure image link. Please retry.')
      if (mounted.current) setLayers(current => current.map((url, position) => position === index ? image.imageUrl : url))
    }, `Layer ${index + 1} uploaded. Publish the scene to apply your artwork.`)
  }

  function publishScene() {
    if (filledLayers !== 4 || loadedCollection !== collection) return
    runAction('scene', async () => {
      const result = await apiPatch(`/homepage-images/mobile-${collection}-editorial`, {
        page: collection, section: 'editorial', slotOrder: 0, altText: `${collectionName} clothing inspiration`, extra: { ...sceneExtra, layers: [...layers] }
      })
      if (!mounted.current) return
      setSavedLayers([...layers])
      setSceneExtra(result?.extra || { ...sceneExtra, layers: [...layers] })
      setSceneUpdatedAt(result?.updatedAt || null)
    }, `${collectionName} artwork published to the website and mobile app.`)
  }

  function restoreArtwork() {
    if (!window.confirm(`Restore the original ${collectionName.toLowerCase()} artwork on the website and app? This replaces the currently published scene.`)) return
    runAction('restore', async () => {
      const result = await apiPatch(`/homepage-images/mobile-${collection}-editorial`, { page: collection, section: 'editorial', slotOrder: 0, extra: { ...sceneExtra, layers: [] } })
      if (!mounted.current) return
      setLayers([...EMPTY_LAYERS])
      setSavedLayers([...EMPTY_LAYERS])
      setSceneExtra(result?.extra || { ...sceneExtra, layers: [] })
      setSceneUpdatedAt(result?.updatedAt || null)
    }, 'Original collection artwork restored on the website and app.')
  }

  const fieldError = key => issues[key] ? <span id={`ms-error-${key}`} className="ms-field-error">{issues[key]}</span> : null

  return <>
    <NavbarAdmin />
    <main className="ms-page">
      <div className="ms-shell">
        <header className="ms-header">
          <div><span className="ms-eyebrow">STORE EXPERIENCE</span><h1>Mobile studio<span className="ms-title-dot" /></h1><p>Manage custom clothing and collection artwork in one place.</p></div>
          <div className="ms-header-actions"><span className={`ms-status ${settingsDirty || sceneDirty ? 'ms-status-draft' : ''}`}><span />{headerStatus}</span><button type="button" className="ms-button ms-button-secondary" disabled={Boolean(busy) || settingsLoading} onClick={reloadSettings}><StudioIcon name="refresh" />{settingsLoading ? 'Loading settings' : 'Reload settings'}</button></div>
        </header>
        <div className="ms-metrics">
          <div className="ms-metric"><span className="ms-metric-icon"><StudioIcon name="shirt" /></span><div><span>Available styles</span><strong>{config ? `${config.customizer.garments.filter(garment => garment.enabled).length} / ${config.customizer.garments.length}` : '—'}</strong></div><small>{config?.customizer.enabled ? 'Design studio enabled' : 'Design studio disabled'}</small></div>
          <div className="ms-metric"><span className="ms-metric-icon"><StudioIcon name="palette" /></span><div><span>Customer choices</span><strong>{config ? `${sizePreview.length} sizes · ${config.customizer.colors.length} colours` : '—'}</strong></div><small>Custom clothing options</small></div>
          <div className="ms-metric"><span className="ms-metric-icon"><StudioIcon name="image" /></span><div><span>{collectionName} artwork</span><strong>{sceneLoading ? 'Loading' : sceneError ? 'Unavailable' : `${filledLayers} / 4 layers`}</strong></div><small>{sceneError ? 'Artwork could not be loaded' : sceneDirty ? 'Changes await publishing' : filledLayers ? 'Custom collection scene' : 'Original artwork'}</small></div>
        </div>
        <nav className="ms-tabs" aria-label="Studio sections">{[{ id: 'clothing', name: 'Clothing settings', icon: 'shirt' }, { id: 'artwork', name: 'Collection artwork', icon: 'image' }, { id: 'policy', name: 'Return policy', icon: 'shield' }].map(item => <button key={item.id} type="button" className={tab === item.id ? 'ms-tab ms-tab-active' : 'ms-tab'} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><StudioIcon name={item.icon} />{item.name}{item.id === 'artwork' && sceneDirty ? <span className="ms-draft-dot" /> : null}</button>)}</nav>
        {notice && <div className={`ms-notice ms-notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><StudioIcon name={notice.type === 'success' ? 'check' : 'shield'} /><span>{notice.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><StudioIcon name="close" /></button></div>}
        {tab === 'clothing' && <div className="ms-section">
          {settingsError && <div className="ms-notice ms-notice-error" role="alert"><span>{settingsError}{config ? ' Your current draft is still shown below.' : ''}</span><button type="button" className="ms-text-button" onClick={reloadSettings} disabled={Boolean(busy) || settingsLoading}>Retry</button></div>}
          {!config ? <section className="ms-empty" aria-busy={settingsLoading}><StudioIcon name="shirt" /><h2>{settingsLoading ? 'Loading clothing settings' : 'Settings unavailable'}</h2><p>{settingsLoading ? 'Getting your saved styles, sizes and colours.' : 'Reload your store settings to continue.'}</p>{!settingsLoading && <button type="button" className="ms-button ms-button-primary" onClick={loadSettings}>Reload settings</button>}</section> : <form onSubmit={saveSettings} noValidate>
            <fieldset className="ms-form-body" disabled={Boolean(busy) || settingsLoading}>
              <section className="ms-panel">
                <div className="ms-section-heading"><div><span className="ms-eyebrow">CUSTOM CLOTHING</span><h2>Styles & pricing</h2><p>Choose which garments customers can personalise.</p></div><label className="ms-toggle"><input type="checkbox" checked={config.customizer.enabled} onChange={event => changeCustomizer(() => ({ enabled: event.target.checked }))} /><span className="ms-toggle-track" /><span>Enable studio</span></label></div>
                {!config.customizer.enabled && <div className="ms-inline-note">The design studio is currently disabled. You can still prepare and save clothing settings.</div>}
                {fieldError('garments')}
                <div className="ms-garments">{config.customizer.garments.map((garment, index) => <article key={garment.id} className={`ms-garment ${garment.enabled ? '' : 'ms-garment-disabled'}`}>
                  <div className="ms-garment-top"><span className="ms-garment-icon"><StudioIcon name="shirt" /></span><label className="ms-toggle ms-toggle-compact"><input type="checkbox" checked={garment.enabled} aria-label={`Enable ${garment.name}`} onChange={event => editGarment(index, 'enabled', event.target.checked)} /><span className="ms-toggle-track" /></label></div>
                  <div className="ms-garment-title"><h3>{garment.name || 'Untitled garment'}</h3><span className={`ms-pill ${garment.enabled ? 'ms-pill-green' : ''}`}>{garment.enabled ? 'Available' : 'Hidden'}</span></div>
                  <label className="ms-field"><span>Garment name</span><input value={garment.name || ''} maxLength={80} aria-invalid={Boolean(issues[`name-${index}`])} aria-describedby={issues[`name-${index}`] ? `ms-error-name-${index}` : undefined} onChange={event => editGarment(index, 'name', event.target.value)} />{fieldError(`name-${index}`)}</label>
                  <div className="ms-price-grid"><label className="ms-field"><span>Selling price</span><div className="ms-currency-input"><span aria-hidden="true">₹</span><input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" aria-label={`Selling price for ${garment.name || `garment ${index + 1}`}`} value={garment.price ?? ''} aria-invalid={Boolean(issues[`price-${index}`])} aria-describedby={issues[`price-${index}`] ? `ms-error-price-${index}` : undefined} onChange={event => editGarment(index, 'price', event.target.value)} /></div>{fieldError(`price-${index}`)}</label><label className="ms-field"><span>Original price</span><div className="ms-currency-input"><span aria-hidden="true">₹</span><input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" aria-label={`Original price for ${garment.name || `garment ${index + 1}`}`} value={garment.mrp ?? ''} aria-invalid={Boolean(issues[`mrp-${index}`])} aria-describedby={issues[`mrp-${index}`] ? `ms-error-mrp-${index}` : undefined} onChange={event => editGarment(index, 'mrp', event.target.value)} /></div>{fieldError(`mrp-${index}`)}</label></div>
                  <div className="ms-price-preview"><strong>{currency(garment.price)}</strong>{Number(garment.mrp) > Number(garment.price) && <><del>{currency(garment.mrp)}</del><span>{Math.round((1 - Number(garment.price) / Number(garment.mrp)) * 100)}% off</span></>}</div>
                </article>)}</div>
              </section>
              <div className="ms-settings-grid">
                <section className="ms-panel"><div className="ms-section-heading"><div><span className="ms-eyebrow">FIT OPTIONS</span><h2>Available sizes</h2><p>These options appear in the custom clothing studio.</p></div></div><label className="ms-field"><span>Sizes, separated by commas</span><input value={sizeText} placeholder="XS, S, M, L, XL, XXL" aria-invalid={Boolean(issues.sizes)} aria-describedby={issues.sizes ? 'ms-error-sizes' : 'ms-sizes-help'} onChange={event => { setSizeText(event.target.value); setIssues({}); setNotice(null) }} />{fieldError('sizes')}</label><div className="ms-size-chips" aria-label="Size preview">{sizePreview.map(size => <span key={size}>{size}</span>)}</div><p className="ms-help" id="ms-sizes-help">Up to 15 sizes. Duplicate entries are saved once.</p></section>
                <section className="ms-panel"><div className="ms-section-heading"><div><span className="ms-eyebrow">CUSTOMER SUPPORT</span><h2>Support contact</h2><p>Give app customers a way to contact your store.</p></div></div><label className="ms-field"><span>Support email</span><input type="email" value={config.support.email} placeholder="support@yourstore.com" aria-invalid={Boolean(issues.email)} aria-describedby={issues.email ? 'ms-error-email' : undefined} onChange={event => { setConfig(current => ({ ...current, support: { ...current.support, email: event.target.value } })); setIssues({}); setNotice(null) }} />{fieldError('email')}</label><p className="ms-help">Saved clothing settings: {dateLabel(config.updated_at)}</p></section>
              </div>
              <section className="ms-panel"><div className="ms-section-heading"><div><span className="ms-eyebrow">COLOUR PALETTE</span><h2>Available colours <span className="ms-count">{config.customizer.colors.length}</span></h2><p>Name each colour and choose its exact shade.</p></div><button type="button" className="ms-button ms-button-secondary" disabled={config.customizer.colors.length >= 24} onClick={() => changeCustomizer(customizer => ({ colors: [...customizer.colors, { name: '', code: '#203a2c' }] }))}><StudioIcon name="plus" />Add colour</button></div>{fieldError('colors')}<div className="ms-colors">{config.customizer.colors.map((color, index) => <div className="ms-color" key={index}><label className="ms-color-picker"><input type="color" aria-label={`Choose shade for colour ${index + 1}`} value={/^#[a-f0-9]{6}$/i.test(color.code) ? color.code : '#000000'} onChange={event => changeCustomizer(customizer => ({ colors: customizer.colors.map((item, position) => position === index ? { ...item, code: event.target.value } : item) }))} /></label><div><label className="ms-field"><span>Colour {index + 1}</span><input value={color.name} maxLength={40} placeholder="Colour name" aria-invalid={Boolean(issues[`color-name-${index}`])} onChange={event => changeCustomizer(customizer => ({ colors: customizer.colors.map((item, position) => position === index ? { ...item, name: event.target.value } : item) }))} />{fieldError(`color-name-${index}`)}</label><label className="ms-field ms-hex-field"><span className="ms-sr-only">Hex code for colour {index + 1}</span><input value={color.code} maxLength={7} spellCheck={false} aria-invalid={Boolean(issues[`color-code-${index}`])} onChange={event => changeCustomizer(customizer => ({ colors: customizer.colors.map((item, position) => position === index ? { ...item, code: event.target.value } : item) }))} />{fieldError(`color-code-${index}`)}</label></div><button type="button" className="ms-icon-button" aria-label={`Remove colour ${index + 1}`} disabled={config.customizer.colors.length <= 1} onClick={() => changeCustomizer(customizer => ({ colors: customizer.colors.filter((_, position) => position !== index) }))}><StudioIcon name="close" /></button></div>)}</div><p className="ms-help">Keep at least one colour. Up to 24 colours are supported.</p></section>
            </fieldset>
            <div className="ms-save-bar"><div><strong>{settingsDirty ? 'You have unsaved clothing changes' : 'Clothing settings are saved'}</strong><span>Save to apply prices, sizes and colours to customer checkout.</span></div><button type="submit" className="ms-button ms-button-primary" disabled={Boolean(busy) || settingsLoading || !settingsDirty}><StudioIcon name="check" />{busy === 'settings' ? 'Saving settings…' : 'Save clothing settings'}</button></div>
          </form>}
        </div>}
        {tab === 'artwork' && <section className="ms-section">
          <div className="ms-section-heading"><div><span className="ms-eyebrow">SHARED COLLECTION SCENES</span><h2>Give every collection its own look</h2><p>Upload four transparent clothing cutouts, then publish the scene to your website and app.</p></div><span className={`ms-pill ${sceneDirty ? 'ms-pill-amber' : 'ms-pill-green'}`}>{sceneLoading ? 'Loading artwork' : sceneError ? 'Artwork unavailable' : sceneDirty ? 'Unpublished changes' : 'Published selection'}</span></div>
          <div className="ms-collection-tabs" aria-label="Collection">{COLLECTIONS.map(item => <button key={item.id} type="button" disabled={Boolean(busy)} className={collection === item.id ? 'ms-collection-active' : ''} aria-pressed={collection === item.id} onClick={() => selectCollection(item.id)}>{item.name}</button>)}</div>
          {sceneError && <div className="ms-notice ms-notice-error" role="alert"><span>{sceneError}</span><button type="button" className="ms-text-button" disabled={Boolean(busy) || sceneLoading} onClick={() => setSceneReload(value => value + 1)}>Retry artwork</button></div>}
          <div className="ms-artwork-layout">
            <div className="ms-layer-grid" aria-busy={sceneLoading}>{layers.map((url, index) => <article className="ms-layer" key={index}><div className="ms-layer-heading"><h3><span>{String(index + 1).padStart(2, '0')}</span>Layer {index + 1}</h3><span className={`ms-pill ${url ? 'ms-pill-green' : ''}`}>{sceneLoading ? 'Loading' : url ? 'Uploaded' : 'Empty'}</span></div><div className="ms-layer-image">{url ? <img src={url} alt={`${collectionName} clothing layer ${index + 1}`} /> : <div><StudioIcon name="image" /><span>{sceneLoading ? 'Loading artwork…' : 'Add a clothing cutout'}</span></div>}</div><label className={`ms-upload ${busy || loadedCollection !== collection ? 'ms-upload-disabled' : ''}`}><StudioIcon name="upload" /><span>{busy === `upload-${index}` ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}</span><input type="file" accept="image/png,image/webp" disabled={Boolean(busy) || loadedCollection !== collection} aria-label={`Upload layer ${index + 1}`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; uploadLayer(file, index) }} /></label><p className="ms-help">PNG or WebP · Up to 3.5 MB</p></article>)}</div>
            <aside className="ms-scene-summary"><span className="ms-eyebrow">SCENE PREVIEW</span><h3>{collectionName} collection</h3><div className="ms-scene-preview">{filledLayers ? layers.map((url, index) => url ? <img key={index} src={url} alt="" className={`ms-scene-piece ms-scene-piece-${index}`} /> : null) : <div><StudioIcon name="image" /><span>Original artwork is selected</span></div>}</div><div className="ms-progress-heading"><span>Uploaded layers</span><strong>{filledLayers} / 4</strong></div><div className="ms-progress" role="progressbar" aria-label="Uploaded collection layers" aria-valuemin={0} aria-valuemax={4} aria-valuenow={filledLayers}><span style={{ width: `${filledLayers * 25}%` }} /></div><p>{filledLayers === 4 ? 'All four layers are ready. Publish to apply the scene.' : 'Upload all four layers before publishing custom artwork.'}</p><div className="ms-publish-note"><StudioIcon name="clock" /><span>Last saved: {dateLabel(sceneUpdatedAt)}</span></div><button type="button" className="ms-button ms-button-primary" disabled={Boolean(busy) || loadedCollection !== collection || filledLayers !== 4 || !sceneDirty} onClick={publishScene}><StudioIcon name="check" />{busy === 'scene' ? 'Publishing…' : 'Publish collection scene'}</button><button type="button" className="ms-button ms-button-secondary" disabled={Boolean(busy) || loadedCollection !== collection || (!filledLayers && !sceneDirty)} onClick={restoreArtwork}>{busy === 'restore' ? 'Restoring…' : 'Restore original artwork'}</button><p className="ms-help">Preview shows your uploaded images. Customer layouts may position the layers differently.</p></aside>
          </div>
          <div className="ms-inline-note"><StudioIcon name="image" /><span>Use transparent clothing images for a clean scene. Website banners are managed in <a href="/homepage-images">Homepage Images</a>.</span></div>
        </section>}
        {tab === 'policy' && <section className="ms-panel ms-policy"><span className="ms-policy-icon"><StudioIcon name="shield" /></span><span className="ms-eyebrow">CUSTOMER RETURNS</span><h2>A clear policy for every order</h2><p>These rules apply to eligible website and mobile purchases.</p><div className="ms-policy-grid"><article><strong>{config?.returns?.window_days || 7} days</strong><h3>Return window</h3><p>The return window starts from confirmed delivery.</p></article><article><strong>Innerwear</strong><h3>Excluded from returns</h3><p>Innerwear items cannot be returned.</p></article><article><strong>Mixed orders</strong><h3>Eligible items only</h3><p>Customers can request a return for eligible items in a mixed order.</p></article></div><div className="ms-inline-note"><StudioIcon name="shield" /><span>The store enforces this policy automatically. Return requests and inspections are handled in <a href="/order-issues">Order operations</a>.</span></div></section>}
        <footer className="ms-footer">V1Garments <span>Shared catalogue, inventory and customer orders</span></footer>
      </div>
    </main>
  </>
}
