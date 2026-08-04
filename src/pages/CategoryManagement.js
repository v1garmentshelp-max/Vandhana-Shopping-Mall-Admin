import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from './NavbarAdmin'
import { apiGet, apiPatch, apiPost, apiPut } from './api'
import './CategoryManagement.css'

const GENDERS = [
  { value: '', label: 'Select gender' },
  { value: 'MEN', label: 'Men' },
  { value: 'WOMEN', label: 'Women' },
  { value: 'KIDS', label: 'Kids' }
]

const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim()
const formatCount = value => Number(value || 0).toLocaleString('en-IN')

function Modal({ title, children, onClose }) {
  return (
    <div className="category-modal-overlay" onMouseDown={onClose}>
      <div className="category-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="category-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function CategoryManagement() {
  const [rows, setRows] = useState([])
  const [gender, setGender] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [editor, setEditor] = useState(null)
  const [statusDialog, setStatusDialog] = useState(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)

    try {
      const data = await apiGet('/api/categories/admin')
      setRows(Array.isArray(data?.rows) ? data.rows : [])
    } catch (error) {
      setRows([])
      setMessage({ type: 'error', text: error?.message || 'Failed to load categories' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [message])

  const genderRows = useMemo(() => {
    return rows.filter(category => category.gender === gender)
  }, [rows, gender])

  const rootCategory = useMemo(() => {
    return genderRows.find(category => category.parent_id == null) || null
  }, [genderRows])

  const childrenMap = useMemo(() => {
    const map = new Map()

    for (const category of genderRows) {
      const key = category.parent_id == null ? 'ROOT' : String(category.parent_id)
      map.set(key, [...(map.get(key) || []), category])
    }

    for (const categories of map.values()) {
      categories.sort((a, b) => {
        const orderDifference = Number(a.sort_order || 0) - Number(b.sort_order || 0)
        if (orderDifference !== 0) return orderDifference
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true })
      })
    }

    return map
  }, [genderRows])

  const dropdownLevels = useMemo(() => {
    if (!rootCategory) return []

    const levels = []
    let parent = rootCategory
    let index = 0

    while (parent) {
      const options = childrenMap.get(String(parent.id)) || []
      if (!options.length) break

      const selectedId = selectedIds[index] || ''

      levels.push({
        index,
        parent,
        options,
        selectedId,
        label: index === 0 ? 'Category' : index === 1 ? 'Subcategory' : `Subcategory Level ${index + 1}`
      })

      if (!selectedId) break

      const selected = options.find(category => String(category.id) === String(selectedId))
      if (!selected) break

      parent = selected
      index += 1
    }

    return levels
  }, [rootCategory, childrenMap, selectedIds])

  const selectedCategory = useMemo(() => {
    if (!selectedIds.length) return null
    const selectedId = selectedIds[selectedIds.length - 1]
    return rows.find(category => String(category.id) === String(selectedId)) || null
  }, [rows, selectedIds])

  const handleGenderChange = event => {
    setGender(event.target.value)
    setSelectedIds([])
    setEditor(null)
    setStatusDialog(null)
  }

  const handleCategoryChange = (levelIndex, value) => {
    setSelectedIds(current => {
      if (!value) return current.slice(0, levelIndex)
      return [...current.slice(0, levelIndex), String(value)]
    })
  }

  const openAdd = () => {
    if (!gender || !rootCategory) {
      setMessage({ type: 'error', text: 'Select gender first' })
      return
    }

    const parent = selectedCategory || rootCategory

    if (!parent.is_active) {
      setMessage({ type: 'error', text: 'Cannot add under an inactive category' })
      return
    }

    if (Number(parent.product_count || 0) > 0) {
      setMessage({ type: 'error', text: 'Products are already assigned to this category' })
      return
    }

    setEditor({
      mode: 'create',
      category: null,
      parent,
      name: '',
      sort_order: ''
    })
  }

  const openUpdate = () => {
    if (!selectedCategory) {
      setMessage({ type: 'error', text: 'Select category first' })
      return
    }

    setEditor({
      mode: 'edit',
      category: selectedCategory,
      parent: rows.find(category => String(category.id) === String(selectedCategory.parent_id)) || null,
      name: selectedCategory.name || '',
      sort_order: String(selectedCategory.sort_order ?? 0)
    })
  }

  const saveCategory = async event => {
    event.preventDefault()

    if (!editor) return

    const name = cleanText(editor.name)
    const sortOrder = editor.sort_order === '' ? null : Number(editor.sort_order)

    if (!name) {
      setMessage({ type: 'error', text: 'Enter category name' })
      return
    }

    if (editor.mode === 'edit' && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      setMessage({ type: 'error', text: 'Enter a valid sort order' })
      return
    }

    setSaving(true)

    try {
      if (editor.mode === 'create') {
        const created = await apiPost('/api/categories', {
          name,
          parent_id: Number(editor.parent.id),
          sort_order: sortOrder
        })

        const nextIds = selectedCategory
          ? [...selectedIds, String(created.id)]
          : [String(created.id)]

        await loadCategories()
        setSelectedIds(nextIds)
        setMessage({ type: 'success', text: 'Category added successfully' })
      } else {
        await apiPut(`/api/categories/${editor.category.id}`, {
          name,
          parent_id: Number(editor.category.parent_id),
          sort_order: sortOrder
        })

        await loadCategories()
        setMessage({ type: 'success', text: 'Category updated successfully' })
      }

      setEditor(null)
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save category' })
    } finally {
      setSaving(false)
    }
  }

  const openStatusDialog = async () => {
    if (!selectedCategory) {
      setMessage({ type: 'error', text: 'Select category first' })
      return
    }

    setStatusDialog({
      category: selectedCategory,
      impact: null,
      loading: true,
      cascade: false
    })

    try {
      const impact = await apiGet(`/api/categories/${selectedCategory.id}/impact`)

      setStatusDialog(current => {
        if (!current) return current
        return { ...current, impact, loading: false }
      })
    } catch (error) {
      setStatusDialog(null)
      setMessage({ type: 'error', text: error?.message || 'Failed to check category' })
    }
  }

  const updateStatus = async () => {
    if (!statusDialog?.category || !statusDialog?.impact) return

    const category = statusDialog.category
    const nextStatus = !category.is_active
    const activeChildren = Number(statusDialog.impact.active_descendant_count || 0)

    if (!nextStatus && activeChildren > 0 && !statusDialog.cascade) {
      setMessage({ type: 'error', text: 'Select the child categories option' })
      return
    }

    setSaving(true)

    try {
      await apiPatch(`/api/categories/${category.id}/status`, {
        is_active: nextStatus,
        cascade: statusDialog.cascade
      })

      await loadCategories()
      setStatusDialog(null)

      setMessage({
        type: 'success',
        text: nextStatus ? 'Category restored successfully' : 'Category deleted successfully'
      })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to update category' })
    } finally {
      setSaving(false)
    }
  }

  const addDisabled =
    !gender ||
    !rootCategory ||
    Boolean(selectedCategory && (!selectedCategory.is_active || Number(selectedCategory.product_count || 0) > 0))

  return (
    <div className="category-page">
      <Navbar />

      {message && (
        <div className={`category-toast ${message.type}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <main className="category-container">
        <section className="category-card">
          <div className="category-header">
            <h1>Category Management</h1>
            <button type="button" className="category-refresh" onClick={loadCategories} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="category-dropdown-grid">
            <label className="category-field">
              <span>Gender</span>
              <select value={gender} onChange={handleGenderChange}>
                {GENDERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {dropdownLevels.map(level => (
              <label className="category-field" key={`${level.parent.id}-${level.index}`}>
                <span>{level.label}</span>
                <select value={level.selectedId} onChange={event => handleCategoryChange(level.index, event.target.value)}>
                  <option value="">Select {level.label.toLowerCase()}</option>
                  {level.options.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.is_active ? '' : ' (Inactive)'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {selectedCategory && (
            <div className="category-selected">
              <div>
                <span>Selected</span>
                <strong>{selectedCategory.category_path}</strong>
              </div>

              <div className="category-selected-meta">
                <span className={selectedCategory.is_active ? 'active' : 'inactive'}>
                  {selectedCategory.is_active ? 'Active' : 'Inactive'}
                </span>
                <span>{formatCount(selectedCategory.product_count)} products</span>
              </div>
            </div>
          )}

          <div className="category-actions">
            <button type="button" className="category-add" disabled={addDisabled} onClick={openAdd}>
              Add Category
            </button>

            <button type="button" className="category-update" disabled={!selectedCategory} onClick={openUpdate}>
              Update Category
            </button>

            <button
              type="button"
              className={selectedCategory?.is_active ? 'category-delete' : 'category-restore'}
              disabled={!selectedCategory}
              onClick={openStatusDialog}
            >
              {selectedCategory?.is_active ? 'Delete Category' : 'Restore Category'}
            </button>
          </div>
        </section>
      </main>

      {editor && (
        <Modal title={editor.mode === 'create' ? 'Add Category' : 'Update Category'} onClose={() => !saving && setEditor(null)}>
          <form className="category-form" onSubmit={saveCategory}>
            <label>
              <span>Gender</span>
              <input type="text" value={gender} disabled />
            </label>

            <label>
              <span>Parent category</span>
              <input type="text" value={editor.parent?.category_path || editor.parent?.name || ''} disabled />
            </label>

            <label>
              <span>Category name</span>
              <input
                type="text"
                autoFocus
                maxLength={100}
                value={editor.name}
                onChange={event => setEditor(current => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label>
              <span>Sort order</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Automatic"
                value={editor.sort_order}
                onChange={event => setEditor(current => ({ ...current, sort_order: event.target.value }))}
              />
            </label>

            <div className="category-modal-actions">
              <button type="button" className="category-cancel" disabled={saving} onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="category-save" disabled={saving}>
                {saving ? 'Saving...' : editor.mode === 'create' ? 'Add Category' : 'Update Category'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {statusDialog && (
        <Modal
          title={statusDialog.category.is_active ? 'Delete Category' : 'Restore Category'}
          onClose={() => !saving && setStatusDialog(null)}
        >
          {statusDialog.loading ? (
            <div className="category-loading">Checking category...</div>
          ) : (
            <div className="category-confirm">
              <p>
                {statusDialog.category.is_active ? 'Delete' : 'Restore'} <strong>{statusDialog.category.name}</strong>?
              </p>

              <div className="category-impact">
                <div>
                  <span>Products</span>
                  <strong>{formatCount(statusDialog.impact.subtree_product_count)}</strong>
                </div>

                <div>
                  <span>Child categories</span>
                  <strong>{formatCount(statusDialog.impact.descendant_count)}</strong>
                </div>
              </div>

              {statusDialog.category.is_active && Number(statusDialog.impact.subtree_product_count || 0) > 0 && (
                <div className="category-warning">
                  Products connected to this category will stop displaying on the website.
                </div>
              )}

              {Number(statusDialog.impact.descendant_count || 0) > 0 && (
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={statusDialog.cascade}
                    onChange={event => setStatusDialog(current => ({ ...current, cascade: event.target.checked }))}
                  />
                  <span>
                    {statusDialog.category.is_active
                      ? 'Delete all child categories also'
                      : 'Restore all child categories also'}
                  </span>
                </label>
              )}

              <div className="category-modal-actions">
                <button type="button" className="category-cancel" disabled={saving} onClick={() => setStatusDialog(null)}>Cancel</button>
                <button
                  type="button"
                  className={statusDialog.category.is_active ? 'category-confirm-delete' : 'category-save'}
                  disabled={saving}
                  onClick={updateStatus}
                >
                  {saving ? 'Updating...' : statusDialog.category.is_active ? 'Delete' : 'Restore'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}