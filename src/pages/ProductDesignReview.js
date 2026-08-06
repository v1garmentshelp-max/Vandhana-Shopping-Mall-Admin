import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from './NavbarAdmin'
import { apiGet, apiPatch, apiPost } from './api'
import './ProductDesignReview.css'

const STATUS_OPTIONS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'APPLIED']

const PATTERN_TYPES = [
  'SOLID',
  'PLAIN',
  'PRINTED',
  'GRAPHIC PRINT',
  'FLORAL',
  'AOP',
  'TEXTURED',
  'PUFF PRINT',
  'OMBRE',
  'CHECKED',
  'FEATHER PRINT'
]

const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim()

const upperText = value => cleanText(value).toUpperCase()

const numberValue = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatNumber = value => numberValue(value).toLocaleString('en-IN')

const formatMoney = value =>
  numberValue(value).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  })

const formatDateTime = value => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN')
}

const getImageUrl = image =>
  cleanText(image?.image_url || image?.secure_url || image?.url)

const getFrontImage = images => {
  const list = Array.isArray(images) ? images : []

  return (
    list.find(image => upperText(image?.image_type) === 'FRONT') ||
    list.find(image => upperText(image?.image_type) === 'MAIN') ||
    list[0] ||
    null
  )
}

const getBackImage = images => {
  const list = Array.isArray(images) ? images : []

  return (
    list.find(image => upperText(image?.image_type) === 'BACK') ||
    null
  )
}

const statusClass = status => {
  const value = upperText(status)

  if (value === 'APPROVED') return 'approved'
  if (value === 'REJECTED') return 'rejected'
  if (value === 'APPLIED') return 'applied'

  return 'pending'
}

const createDraft = variant => ({
  proposed_design_code: cleanText(variant?.proposed_design_code),
  proposed_pattern_type: cleanText(variant?.proposed_pattern_type),
  notes: cleanText(variant?.notes)
})

const draftChanged = (variant, draft) => {
  if (!variant || !draft) return false

  return (
    cleanText(variant.proposed_design_code) !==
      cleanText(draft.proposed_design_code) ||
    cleanText(variant.proposed_pattern_type) !==
      cleanText(draft.proposed_pattern_type) ||
    cleanText(variant.notes) !== cleanText(draft.notes)
  )
}

function ConfirmDialog({
  dialog,
  busy,
  onCancel,
  onConfirm
}) {
  if (!dialog) return null

  return (
    <div
      className="pdr-modal-backdrop"
      onMouseDown={busy ? undefined : onCancel}
    >
      <div
        className="pdr-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="pdr-modal-header">
          <div>
            <div className="pdr-modal-kicker">
              Confirm action
            </div>

            <h2>{dialog.title}</h2>
          </div>

          <button
            type="button"
            className="pdr-icon-button"
            onClick={onCancel}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="pdr-modal-body">
          <p>{dialog.message}</p>

          {dialog.details?.length ? (
            <div className="pdr-confirm-details">
              {dialog.details.map(item => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {dialog.inputLabel ? (
            <label className="pdr-field">
              <span>{dialog.inputLabel}</span>

              <textarea
                value={dialog.inputValue || ''}
                onChange={event =>
                  dialog.onInputChange?.(event.target.value)
                }
                placeholder={dialog.inputPlaceholder || ''}
                rows={4}
                disabled={busy}
              />
            </label>
          ) : null}

          {dialog.requirePhrase ? (
            <label className="pdr-field">
              <span>
                Type {dialog.requirePhrase} to continue
              </span>

              <input
                value={dialog.phraseValue || ''}
                onChange={event =>
                  dialog.onPhraseChange?.(event.target.value)
                }
                autoComplete="off"
                disabled={busy}
              />
            </label>
          ) : null}
        </div>

        <div className="pdr-modal-actions">
          <button
            type="button"
            className="pdr-button secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`pdr-button ${
              dialog.danger ? 'danger' : 'primary'
            }`}
            onClick={onConfirm}
            disabled={
              busy ||
              Boolean(dialog.confirmDisabled)
            }
          >
            {busy
              ? 'Processing…'
              : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductDesignReview() {
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [status, setStatus] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [loadingProducts, setLoadingProducts] =
    useState(true)
  const [selectedProductId, setSelectedProductId] =
    useState(null)
  const [productDetail, setProductDetail] =
    useState(null)
  const [variants, setVariants] = useState([])
  const [drafts, setDrafts] = useState({})
  const [selectedVariantIds, setSelectedVariantIds] =
    useState([])
  const [bulkDesignCode, setBulkDesignCode] =
    useState('')
  const [bulkPatternType, setBulkPatternType] =
    useState('')
  const [loadingDetail, setLoadingDetail] =
    useState(false)
  const [savingVariantIds, setSavingVariantIds] =
    useState([])
  const [actionBusy, setActionBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [dialog, setDialog] = useState(null)

  const offset = (page - 1) * pageSize

  const pageCount = Math.max(
    1,
    Math.ceil(totalProducts / pageSize)
  )

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text })
  }, [])

  useEffect(() => {
    if (!message) return undefined

    const timer = setTimeout(
      () => setMessage(null),
      4200
    )

    return () => clearTimeout(timer)
  }, [message])

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiGet(
        '/api/product-design-review/summary'
      )

      setSummary(data || null)
    } catch (error) {
      showMessage(
        'error',
        error?.message ||
          'Failed to load review summary'
      )
    }
  }, [showMessage])

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)

    try {
      const data = await apiGet(
        '/api/product-design-review',
        {
          status,
          search,
          limit: pageSize,
          offset
        }
      )

      const items = Array.isArray(data?.items)
        ? data.items
        : []

      setProducts(items)
      setTotalProducts(numberValue(data?.total))

      if (
        selectedProductId &&
        !items.some(
          item =>
            Number(item.product_id) ===
            Number(selectedProductId)
        )
      ) {
        setSelectedProductId(null)
        setProductDetail(null)
        setVariants([])
        setDrafts({})
        setSelectedVariantIds([])
      }
    } catch (error) {
      setProducts([])
      setTotalProducts(0)

      showMessage(
        'error',
        error?.message ||
          'Failed to load review products'
      )
    } finally {
      setLoadingProducts(false)
    }
  }, [
    offset,
    pageSize,
    search,
    selectedProductId,
    showMessage,
    status
  ])

  const loadProductDetail = useCallback(
    async productId => {
      if (!productId) return

      setLoadingDetail(true)
      setSelectedVariantIds([])
      setBulkDesignCode('')
      setBulkPatternType('')

      try {
        const data = await apiGet(
          `/api/product-design-review/${encodeURIComponent(
            productId
          )}`
        )

        const nextVariants = Array.isArray(
          data?.variants
        )
          ? data.variants
          : []

        const nextDrafts = {}

        nextVariants.forEach(variant => {
          nextDrafts[String(variant.variant_id)] =
            createDraft(variant)
        })

        setProductDetail(data?.product || null)
        setVariants(nextVariants)
        setDrafts(nextDrafts)
      } catch (error) {
        setProductDetail(null)
        setVariants([])
        setDrafts({})

        showMessage(
          'error',
          error?.message ||
            'Failed to load product review'
        )
      } finally {
        setLoadingDetail(false)
      }
    },
    [showMessage]
  )

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (selectedProductId) {
      loadProductDetail(selectedProductId)
    }
  }, [loadProductDetail, selectedProductId])

  const dirtyVariantIds = useMemo(
    () =>
      variants
        .filter(variant =>
          draftChanged(
            variant,
            drafts[String(variant.variant_id)]
          )
        )
        .map(variant =>
          Number(variant.variant_id)
        ),
    [drafts, variants]
  )

  const selectedSet = useMemo(
    () =>
      new Set(
        selectedVariantIds.map(value =>
          String(value)
        )
      ),
    [selectedVariantIds]
  )

  const effectiveGroups = useMemo(() => {
    const map = new Map()

    variants.forEach(variant => {
      const draft =
        drafts[String(variant.variant_id)] ||
        createDraft(variant)

      const code = upperText(
        draft.proposed_design_code ||
          variant.current_design_code ||
          productDetail?.design_code
      )

      const pattern = upperText(
        draft.proposed_pattern_type ||
          variant.current_pattern_type ||
          productDetail?.pattern_type
      )

      const key = code || 'UNMAPPED'

      if (!map.has(key)) {
        map.set(key, {
          designCode: key,
          patternType: pattern || '-',
          count: 0,
          variantIds: []
        })
      }

      const group = map.get(key)

      group.count += 1

      group.variantIds.push(
        Number(variant.variant_id)
      )

      if (
        pattern &&
        group.patternType === '-'
      ) {
        group.patternType = pattern
      }
    })

    return Array.from(map.values()).sort(
      (a, b) =>
        a.designCode.localeCompare(
          b.designCode
        )
    )
  }, [drafts, productDetail, variants])

  const allSelected =
    variants.length > 0 &&
    selectedVariantIds.length === variants.length

  const hasAppliedRows = variants.some(
    variant =>
      upperText(variant.review_status) ===
      'APPLIED'
  )

  const allApproved =
    variants.length > 0 &&
    variants.every(
      variant =>
        upperText(variant.review_status) ===
        'APPROVED'
    )

  const canApply =
    allApproved &&
    !hasAppliedRows &&
    dirtyVariantIds.length === 0

  const updateDraft = (
    variantId,
    field,
    value
  ) => {
    setDrafts(current => ({
      ...current,
      [String(variantId)]: {
        ...(current[String(variantId)] ||
          {}),
        [field]: value
      }
    }))
  }

  const toggleVariant = variantId => {
    setSelectedVariantIds(current => {
      const key = String(variantId)

      return current.some(
        value => String(value) === key
      )
        ? current.filter(
            value => String(value) !== key
          )
        : [...current, Number(variantId)]
    })
  }

  const toggleAllVariants = () => {
    setSelectedVariantIds(
      allSelected
        ? []
        : variants.map(variant =>
            Number(variant.variant_id)
          )
    )
  }

  const applyBulkDraft = () => {
    if (!selectedVariantIds.length) {
      showMessage(
        'error',
        'Select at least one variant'
      )

      return
    }

    const designCode =
      upperText(bulkDesignCode)

    const patternType =
      upperText(bulkPatternType)

    if (!designCode && !patternType) {
      showMessage(
        'error',
        'Enter a design code or pattern type'
      )

      return
    }

    setDrafts(current => {
      const next = { ...current }

      selectedVariantIds.forEach(
        variantId => {
          const key = String(variantId)

          next[key] = {
            ...(next[key] || {}),
            ...(designCode
              ? {
                  proposed_design_code:
                    designCode
                }
              : {}),
            ...(patternType
              ? {
                  proposed_pattern_type:
                    patternType
                }
              : {})
          }
        }
      )

      return next
    })

    showMessage(
      'success',
      `Draft mapping applied to ${
        selectedVariantIds.length
      } variant${
        selectedVariantIds.length === 1
          ? ''
          : 's'
      }`
    )
  }

  const resetSelectedDrafts = () => {
    if (!selectedVariantIds.length) {
      showMessage(
        'error',
        'Select at least one variant'
      )

      return
    }

    setDrafts(current => {
      const next = { ...current }

      selectedVariantIds.forEach(
        variantId => {
          const variant = variants.find(
            item =>
              Number(item.variant_id) ===
              Number(variantId)
          )

          if (variant) {
            next[String(variantId)] =
              createDraft(variant)
          }
        }
      )

      return next
    })
  }

  const saveVariant = async variantId => {
    const variant = variants.find(
      item =>
        Number(item.variant_id) ===
        Number(variantId)
    )

    const draft =
      drafts[String(variantId)]

    if (
      !variant ||
      !draft ||
      !draftChanged(variant, draft)
    ) {
      return null
    }

    const payload = {
      proposed_design_code:
        upperText(
          draft.proposed_design_code
        ) || null,
      proposed_pattern_type:
        upperText(
          draft.proposed_pattern_type
        ) || null,
      notes: cleanText(draft.notes) || null
    }

    setSavingVariantIds(current => [
      ...new Set([
        ...current,
        Number(variantId)
      ])
    ])

    try {
      return await apiPatch(
        `/api/product-design-review/variant/${encodeURIComponent(
          variantId
        )}`,
        payload
      )
    } finally {
      setSavingVariantIds(current =>
        current.filter(
          value =>
            Number(value) !==
            Number(variantId)
        )
      )
    }
  }

  const saveRows = async variantIds => {
    const ids = variantIds.filter(
      variantId =>
        dirtyVariantIds.includes(
          Number(variantId)
        )
    )

    if (!ids.length) {
      showMessage(
        'error',
        'No unsaved mapping changes'
      )

      return
    }

    setActionBusy(true)

    try {
      for (const variantId of ids) {
        await saveVariant(variantId)
      }

      await Promise.all([
        loadProductDetail(
          selectedProductId
        ),
        loadProducts(),
        loadSummary()
      ])

      showMessage(
        'success',
        `${ids.length} variant mapping${
          ids.length === 1 ? '' : 's'
        } saved`
      )
    } catch (error) {
      showMessage(
        'error',
        error?.message ||
          'Failed to save variant mapping'
      )
    } finally {
      setActionBusy(false)
    }
  }

  const saveAllDirty = () =>
    saveRows(dirtyVariantIds)

  const saveSelected = () =>
    saveRows(selectedVariantIds)

  const refreshAll = async () => {
    await Promise.all([
      loadSummary(),
      loadProducts(),
      selectedProductId
        ? loadProductDetail(
            selectedProductId
          )
        : Promise.resolve()
    ])
  }

  const openApproveDialog = () => {
    if (!selectedProductId) return

    if (dirtyVariantIds.length) {
      showMessage(
        'error',
        'Save all mapping changes before approval'
      )

      return
    }

    const invalidGroups =
      effectiveGroups.filter(
        group =>
          !group.designCode ||
          group.designCode === 'UNMAPPED'
      )

    if (invalidGroups.length) {
      showMessage(
        'error',
        'Every variant requires a design code before approval'
      )

      return
    }

    setDialog({
      type: 'approve',
      title:
        'Approve product design mapping',
      message:
        'All review rows for this product will be marked as approved. Review the design groups before continuing.',
      confirmLabel: 'Approve mapping',
      details: [
        {
          label: 'Product',
          value: `#${selectedProductId} ${
            productDetail?.name || ''
          }`.trim()
        },
        {
          label: 'Variants',
          value: formatNumber(
            variants.length
          )
        },
        {
          label: 'Design groups',
          value: formatNumber(
            effectiveGroups.length
          )
        }
      ]
    })
  }

  const openRejectDialog = () => {
    if (!selectedProductId) return

    const updateReason = value => {
      setDialog(current => ({
        ...current,
        inputValue: value,
        confirmDisabled: !cleanText(value)
      }))
    }

    setDialog({
      type: 'reject',
      title:
        'Reject product design mapping',
      message:
        'All non-applied review rows for this product will be marked as rejected.',
      confirmLabel: 'Reject mapping',
      danger: true,
      inputLabel: 'Reason',
      inputPlaceholder:
        'Enter the rejection reason',
      inputValue: '',
      confirmDisabled: true,
      onInputChange: updateReason,
      details: [
        {
          label: 'Product',
          value: `#${selectedProductId} ${
            productDetail?.name || ''
          }`.trim()
        },
        {
          label: 'Variants',
          value: formatNumber(
            variants.length
          )
        }
      ]
    })
  }

  const openApplyDialog = () => {
    if (!selectedProductId) return

    if (!canApply) {
      showMessage(
        'error',
        'All rows must be approved and saved before applying the split'
      )

      return
    }

    const updatePhrase = value => {
      setDialog(current => ({
        ...current,
        phraseValue: value,
        confirmDisabled:
          upperText(value) !== 'APPLY'
      }))
    }

    setDialog({
      type: 'apply',
      title: 'Apply product design split',
      message:
        'This operation moves variants into their approved design groups and updates linked sale references inside one database transaction.',
      confirmLabel: 'Apply split',
      danger: true,
      requirePhrase: 'APPLY',
      phraseValue: '',
      confirmDisabled: true,
      onPhraseChange: updatePhrase,
      details: [
        {
          label: 'Source product',
          value: `#${selectedProductId}`
        },
        {
          label: 'Variants',
          value: formatNumber(
            variants.length
          )
        },
        {
          label: 'Design groups',
          value: formatNumber(
            effectiveGroups.length
          )
        },
        {
          label:
            'New products expected',
          value: formatNumber(
            Math.max(
              0,
              effectiveGroups.length - 1
            )
          )
        }
      ]
    })
  }

  const confirmDialogAction = async () => {
    if (!dialog || !selectedProductId) {
      return
    }

    setActionBusy(true)

    try {
      if (dialog.type === 'approve') {
        await apiPost(
          `/api/product-design-review/${encodeURIComponent(
            selectedProductId
          )}/approve`,
          {}
        )

        showMessage(
          'success',
          'Product design mapping approved'
        )
      }

      if (dialog.type === 'reject') {
        await apiPost(
          `/api/product-design-review/${encodeURIComponent(
            selectedProductId
          )}/reject`,
          {
            reason: cleanText(
              dialog.inputValue
            )
          }
        )

        showMessage(
          'success',
          'Product design mapping rejected'
        )
      }

      if (dialog.type === 'apply') {
        const result = await apiPost(
          `/api/product-design-review/${encodeURIComponent(
            selectedProductId
          )}/apply`,
          {}
        )

        const moved = numberValue(
          result?.moved_variant_count ??
            result?.movedVariantCount
        )

        const created = Array.isArray(
          result?.created_products
        )
          ? result.created_products.length
          : numberValue(
              result?.created_product_count ??
                result?.createdProductCount
            )

        showMessage(
          'success',
          `Design split applied. ${moved} variants moved and ${created} products created.`
        )
      }

      setDialog(null)
      await refreshAll()
    } catch (error) {
      showMessage(
        'error',
        error?.message || 'Action failed'
      )
    } finally {
      setActionBusy(false)
    }
  }

  const submitSearch = event => {
    event.preventDefault()
    setPage(1)
    setSearch(cleanText(searchInput))
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  return (
    <div className="pdr-page">
      <Navbar />

      <main className="pdr-main">
        <section className="pdr-summary-shell">
          <div className="pdr-summary-grid">
            <div className="pdr-summary-card total">
              <span>Total products</span>

              <strong>
                {formatNumber(
                  summary?.total_products
                )}
              </strong>

              <small>
                {formatNumber(
                  summary?.total_rows
                )}{' '}
                review rows
              </small>
            </div>

            <div className="pdr-summary-card pending">
              <span>Pending</span>

              <strong>
                {formatNumber(
                  summary?.pending_rows
                )}
              </strong>

              <small>
                Rows awaiting review
              </small>
            </div>

            <div className="pdr-summary-card approved">
              <span>Approved</span>

              <strong>
                {formatNumber(
                  summary?.approved_rows
                )}
              </strong>

              <small>Ready for apply</small>
            </div>

            <div className="pdr-summary-card mapped">
              <span>Mapped designs</span>

              <strong>
                {formatNumber(
                  summary?.mapped_design_rows
                )}
              </strong>

              <small>
                {formatNumber(
                  summary?.mapped_pattern_rows
                )}{' '}
                pattern mappings
              </small>
            </div>

            <div className="pdr-summary-card applied">
              <span>Applied</span>

              <strong>
                {formatNumber(
                  summary?.applied_rows
                )}
              </strong>

              <small>Rows completed</small>
            </div>

            <button
              type="button"
              className="pdr-refresh-card"
              onClick={refreshAll}
              disabled={actionBusy}
            >
              <span
                className="pdr-refresh-icon"
                aria-hidden="true"
              >
                ↻
              </span>

              <strong>
                {actionBusy
                  ? 'Refreshing…'
                  : 'Refresh'}
              </strong>

              <small>
                Reload review data
              </small>
            </button>
          </div>
        </section>

        {message ? (
          <div
            className={`pdr-alert ${message.type}`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="pdr-workspace">
          <aside className="pdr-product-panel">
            <div className="pdr-panel-header">
              <div>
                <h2>Review products</h2>

                <span>
                  {formatNumber(
                    totalProducts
                  )}{' '}
                  products
                </span>
              </div>
            </div>

            <form
              className="pdr-search"
              onSubmit={submitSearch}
            >
              <input
                value={searchInput}
                onChange={event =>
                  setSearchInput(
                    event.target.value
                  )
                }
                placeholder="Search product, brand, design or barcode"
              />

              <button
                type="submit"
                className="pdr-button primary"
              >
                Search
              </button>

              {search ? (
                <button
                  type="button"
                  className="pdr-button ghost"
                  onClick={clearSearch}
                >
                  Clear
                </button>
              ) : null}
            </form>

            <div className="pdr-status-tabs">
              {STATUS_OPTIONS.map(option => (
                <button
                  type="button"
                  key={option}
                  className={
                    status === option
                      ? 'active'
                      : ''
                  }
                  onClick={() => {
                    setStatus(option)
                    setPage(1)
                  }}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="pdr-product-list">
              {loadingProducts ? (
                <div className="pdr-empty">
                  Loading products…
                </div>
              ) : null}

              {!loadingProducts &&
              !products.length ? (
                <div className="pdr-empty">
                  No review products found
                </div>
              ) : null}

              {!loadingProducts &&
                products.map(product => {
                  const selected =
                    Number(
                      selectedProductId
                    ) ===
                    Number(
                      product.product_id
                    )

                  const productStatus =
                    product.applied_count > 0
                      ? 'APPLIED'
                      : product.rejected_count >
                          0
                        ? 'REJECTED'
                        : product.approved_count ===
                            product.variant_count
                          ? 'APPROVED'
                          : 'PENDING'

                  return (
                    <button
                      type="button"
                      key={
                        product.product_id
                      }
                      className={`pdr-product-card ${
                        selected
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setSelectedProductId(
                          Number(
                            product.product_id
                          )
                        )
                      }
                    >
                      <div className="pdr-product-card-top">
                        <span
                          className={`pdr-status ${statusClass(
                            productStatus
                          )}`}
                        >
                          {productStatus}
                        </span>

                        <span>
                          #{product.product_id}
                        </span>
                      </div>

                      <h3>
                        {
                          product.product_name
                        }
                      </h3>

                      <p>
                        {product.brand_name ||
                          '-'}
                      </p>

                      <div className="pdr-product-meta">
                        <span>
                          {product.product_design_code ||
                            'No design code'}
                        </span>

                        <span>
                          {product.product_pattern_type ||
                            product.pattern_code ||
                            'No pattern'}
                        </span>
                      </div>

                      <div className="pdr-product-counts">
                        <span>
                          {formatNumber(
                            product.variant_count
                          )}{' '}
                          variants
                        </span>

                        <span>
                          {formatNumber(
                            product.effective_design_count
                          )}{' '}
                          designs
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>

            <div className="pdr-pagination">
              <button
                type="button"
                className="pdr-button ghost"
                onClick={() =>
                  setPage(current =>
                    Math.max(
                      1,
                      current - 1
                    )
                  )
                }
                disabled={
                  page <= 1 ||
                  loadingProducts
                }
              >
                Previous
              </button>

              <span>
                {page} / {pageCount}
              </span>

              <button
                type="button"
                className="pdr-button ghost"
                onClick={() =>
                  setPage(current =>
                    Math.min(
                      pageCount,
                      current + 1
                    )
                  )
                }
                disabled={
                  page >= pageCount ||
                  loadingProducts
                }
              >
                Next
              </button>
            </div>
          </aside>

          <section className="pdr-detail-panel">
            {!selectedProductId ? (
              <div className="pdr-detail-empty">
                <div className="pdr-detail-empty-icon">
                  DR
                </div>

                <h2>Select a product</h2>

                <p>
                  Choose a product from the
                  left panel to review
                  barcode-level variants.
                </p>
              </div>
            ) : null}

            {selectedProductId &&
            loadingDetail ? (
              <div className="pdr-detail-empty">
                <h2>
                  Loading product review…
                </h2>
              </div>
            ) : null}

            {selectedProductId &&
            !loadingDetail &&
            productDetail ? (
              <>
                <div className="pdr-detail-header">
                  <div>
                    <div className="pdr-detail-kicker">
                      Product #
                      {productDetail.id}
                    </div>

                    <h2>
                      {productDetail.name}
                    </h2>

                    <p>
                      {productDetail.brand_name ||
                        '-'}{' '}
                      ·{' '}
                      {productDetail.gender ||
                        '-'}{' '}
                      · Category #
                      {productDetail.category_id ||
                        '-'}
                    </p>
                  </div>

                  <div className="pdr-current-metadata">
                    <div>
                      <span>
                        Current design
                      </span>

                      <strong>
                        {productDetail.design_code ||
                          '-'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Pattern type
                      </span>

                      <strong>
                        {productDetail.pattern_type ||
                          '-'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Legacy pattern
                      </span>

                      <strong>
                        {productDetail.pattern_code ||
                          '-'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pdr-group-summary">
                  <div className="pdr-group-summary-title">
                    <div>
                      <h3>
                        Effective design
                        groups
                      </h3>

                      <p>
                        Calculated from
                        saved values and
                        current unsaved
                        drafts.
                      </p>
                    </div>

                    <span>
                      {
                        effectiveGroups.length
                      }{' '}
                      groups
                    </span>
                  </div>

                  <div className="pdr-group-chips">
                    {effectiveGroups.map(
                      group => (
                        <div
                          className="pdr-group-chip"
                          key={
                            group.designCode
                          }
                        >
                          <strong>
                            {
                              group.designCode
                            }
                          </strong>

                          <span>
                            {
                              group.patternType
                            }
                          </span>

                          <small>
                            {group.count}{' '}
                            variants
                          </small>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {!hasAppliedRows ? (
                  <div className="pdr-bulk-toolbar">
                    <label className="pdr-select-all">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={
                          toggleAllVariants
                        }
                      />

                      <span>Select all</span>
                    </label>

                    <span className="pdr-selected-count">
                      {
                        selectedVariantIds.length
                      }{' '}
                      selected
                    </span>

                    <input
                      value={
                        bulkDesignCode
                      }
                      onChange={event =>
                        setBulkDesignCode(
                          event.target.value
                        )
                      }
                      placeholder="Design code"
                    />

                    <input
                      value={
                        bulkPatternType
                      }
                      onChange={event =>
                        setBulkPatternType(
                          event.target.value
                        )
                      }
                      placeholder="Pattern type"
                      list="pdr-pattern-types"
                    />

                    <datalist id="pdr-pattern-types">
                      {PATTERN_TYPES.map(
                        item => (
                          <option
                            key={item}
                            value={item}
                          />
                        )
                      )}
                    </datalist>

                    <button
                      type="button"
                      className="pdr-button secondary"
                      onClick={
                        applyBulkDraft
                      }
                      disabled={actionBusy}
                    >
                      Apply to selected
                    </button>

                    <button
                      type="button"
                      className="pdr-button ghost"
                      onClick={
                        resetSelectedDrafts
                      }
                      disabled={actionBusy}
                    >
                      Reset selected
                    </button>

                    <button
                      type="button"
                      className="pdr-button primary"
                      onClick={saveSelected}
                      disabled={
                        actionBusy ||
                        !selectedVariantIds.length
                      }
                    >
                      Save selected
                    </button>
                  </div>
                ) : null}

                <div className="pdr-variant-list">
                  {variants.map(
                    variant => {
                      const variantId =
                        Number(
                          variant.variant_id
                        )

                      const draft =
                        drafts[
                          String(variantId)
                        ] ||
                        createDraft(
                          variant
                        )

                      const dirty =
                        draftChanged(
                          variant,
                          draft
                        )

                      const saving =
                        savingVariantIds.includes(
                          variantId
                        )

                      const frontImage =
                        getFrontImage(
                          variant.images
                        )

                      const backImage =
                        getBackImage(
                          variant.images
                        )

                      const rowApplied =
                        upperText(
                          variant.review_status
                        ) === 'APPLIED'

                      return (
                        <article
                          className={`pdr-variant-card ${
                            dirty
                              ? 'dirty'
                              : ''
                          }`}
                          key={variantId}
                        >
                          <div className="pdr-variant-select">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(
                                String(
                                  variantId
                                )
                              )}
                              onChange={() =>
                                toggleVariant(
                                  variantId
                                )
                              }
                              disabled={
                                rowApplied
                              }
                            />
                          </div>

                          <div className="pdr-images">
                            <div className="pdr-image-box">
                              {getImageUrl(
                                frontImage
                              ) ? (
                                <img
                                  src={getImageUrl(
                                    frontImage
                                  )}
                                  alt={`${variant.ean_code} front`}
                                />
                              ) : (
                                <span>
                                  No front
                                  image
                                </span>
                              )}

                              <small>
                                Front
                              </small>
                            </div>

                            <div className="pdr-image-box">
                              {getImageUrl(
                                backImage
                              ) ? (
                                <img
                                  src={getImageUrl(
                                    backImage
                                  )}
                                  alt={`${variant.ean_code} back`}
                                />
                              ) : (
                                <span>
                                  No back
                                  image
                                </span>
                              )}

                              <small>
                                Back
                              </small>
                            </div>
                          </div>

                          <div className="pdr-variant-info">
                            <div className="pdr-variant-title-row">
                              <div>
                                <span className="pdr-barcode">
                                  {variant.ean_code ||
                                    '-'}
                                </span>

                                <small>
                                  Variant #
                                  {variantId}
                                </small>
                              </div>

                              <span
                                className={`pdr-status ${statusClass(
                                  variant.review_status
                                )}`}
                              >
                                {
                                  variant.review_status
                                }
                              </span>
                            </div>

                            <div className="pdr-variant-properties">
                              <div>
                                <span>
                                  Colour
                                </span>

                                <strong>
                                  {variant.colour ||
                                    '-'}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Size
                                </span>

                                <strong>
                                  {variant.size ||
                                    '-'}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  MRP
                                </span>

                                <strong>
                                  {formatMoney(
                                    variant.mrp
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Sale price
                                </span>

                                <strong>
                                  {formatMoney(
                                    variant.sale_price
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Available
                                </span>

                                <strong>
                                  {formatNumber(
                                    variant.available_qty
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Reserved
                                </span>

                                <strong>
                                  {formatNumber(
                                    variant.reserved
                                  )}
                                </strong>
                              </div>
                            </div>

                            <div className="pdr-reference-pills">
                              <span>
                                Sales{' '}
                                {formatNumber(
                                  variant.sale_rows
                                )}
                              </span>

                              <span>
                                Returns{' '}
                                {formatNumber(
                                  variant.return_rows
                                )}
                              </span>

                              <span>
                                Cart{' '}
                                {formatNumber(
                                  variant.cart_rows
                                )}
                              </span>

                              <span>
                                Wishlist{' '}
                                {formatNumber(
                                  variant.wishlist_rows
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="pdr-mapping-fields">
                            <label className="pdr-field">
                              <span>
                                Proposed design
                                code
                              </span>

                              <input
                                value={
                                  draft.proposed_design_code
                                }
                                onChange={event =>
                                  updateDraft(
                                    variantId,
                                    'proposed_design_code',
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={
                                  variant.current_design_code ||
                                  productDetail.design_code ||
                                  'P-000000-D01'
                                }
                                disabled={
                                  rowApplied
                                }
                              />
                            </label>

                            <label className="pdr-field">
                              <span>
                                Proposed pattern
                                type
                              </span>

                              <input
                                value={
                                  draft.proposed_pattern_type
                                }
                                onChange={event =>
                                  updateDraft(
                                    variantId,
                                    'proposed_pattern_type',
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={
                                  variant.current_pattern_type ||
                                  productDetail.pattern_type ||
                                  'Pattern type'
                                }
                                list="pdr-pattern-types"
                                disabled={
                                  rowApplied
                                }
                              />
                            </label>

                            <label className="pdr-field full">
                              <span>Notes</span>

                              <textarea
                                value={
                                  draft.notes
                                }
                                onChange={event =>
                                  updateDraft(
                                    variantId,
                                    'notes',
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Review note"
                                rows={2}
                                disabled={
                                  rowApplied
                                }
                              />
                            </label>

                            <div className="pdr-row-footer">
                              <span>
                                {dirty
                                  ? 'Unsaved changes'
                                  : `Updated ${formatDateTime(
                                      variant.updated_at
                                    )}`}
                              </span>

                              {!rowApplied ? (
                                <button
                                  type="button"
                                  className="pdr-button small primary"
                                  onClick={() =>
                                    saveRows([
                                      variantId
                                    ])
                                  }
                                  disabled={
                                    !dirty ||
                                    saving ||
                                    actionBusy
                                  }
                                >
                                  {saving
                                    ? 'Saving…'
                                    : 'Save row'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      )
                    }
                  )}
                </div>

                <div className="pdr-action-bar">
                  <div>
                    <strong>
                      {
                        dirtyVariantIds.length
                      }{' '}
                      unsaved rows
                    </strong>

                    <span>
                      {variants.length}{' '}
                      total variants ·{' '}
                      {
                        effectiveGroups.length
                      }{' '}
                      effective groups
                    </span>
                  </div>

                  <div className="pdr-action-buttons">
                    <button
                      type="button"
                      className="pdr-button secondary"
                      onClick={saveAllDirty}
                      disabled={
                        !dirtyVariantIds.length ||
                        actionBusy ||
                        hasAppliedRows
                      }
                    >
                      Save all changes
                    </button>

                    <button
                      type="button"
                      className="pdr-button danger-outline"
                      onClick={
                        openRejectDialog
                      }
                      disabled={
                        actionBusy ||
                        hasAppliedRows
                      }
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      className="pdr-button primary"
                      onClick={
                        openApproveDialog
                      }
                      disabled={
                        actionBusy ||
                        hasAppliedRows
                      }
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      className="pdr-button danger"
                      onClick={
                        openApplyDialog
                      }
                      disabled={
                        actionBusy ||
                        !canApply
                      }
                    >
                      Apply split
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </section>
      </main>

      <ConfirmDialog
        dialog={dialog}
        busy={actionBusy}
        onCancel={() => setDialog(null)}
        onConfirm={confirmDialogAction}
      />
    </div>
  )
}