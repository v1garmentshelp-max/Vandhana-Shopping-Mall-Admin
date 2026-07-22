import React, { useCallback, useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import Navbar from './NavbarAdmin'
import { useAuth } from './AdminAuth'
import { useLoading } from './LoadingContext'
import { apiGet, apiPost, apiUpload } from './api'
import './ImportStock.css'

const CLOUD_NAME = 'digu2krba'
const UPLOAD_PRESET = 'unsigned_ean'
const PROCESS_LIMIT = 250
const DEFAULT_BRANCH_ID = 3

const CATEGORY_TYPES = [
  { value: 'MEN', label: "Men's Wear" },
  { value: 'WOMEN', label: "Women's Wear" },
  { value: 'KIDS_BOYS', label: 'Kids Boys' },
  { value: 'KIDS_GIRLS', label: 'Kids Girls' }
]

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeBarcode(value) {
  return String(value ?? '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, '')
}

function normalizeImageType(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')

  if (!normalized) return ''
  if (normalized === 'f') return 'front'
  if (normalized === 'b') return 'back'
  if (normalized.includes('front')) return 'front'
  if (normalized.includes('back')) return 'back'
  if (normalized.includes('main')) return 'front'
  return ''
}

function normalizeBranchId(value) {
  const branchId = Number(value)
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null
}

function getGenderFromCategoryType(value) {
  if (value === 'MEN') return 'MEN'
  if (value === 'WOMEN') return 'WOMEN'
  if (value === 'KIDS_BOYS' || value === 'KIDS_GIRLS') return 'KIDS'
  return ''
}

function getCategoryTypeLabel(value) {
  return CATEGORY_TYPES.find(item => item.value === value)?.label || ''
}

function getCategoryPath(category) {
  return String(category?.category_path || category?.label || category?.name || '').replace(/\s+/g, ' ').trim()
}

function matchesCategoryType(category, categoryType) {
  if (!categoryType) return false

  const gender = getGenderFromCategoryType(categoryType)
  const categoryGender = String(category?.gender || '').toUpperCase()
  const path = getCategoryPath(category).toLowerCase()

  if (categoryGender !== gender) return false

  if (categoryType === 'MEN') return path.startsWith('men') || categoryGender === 'MEN'
  if (categoryType === 'WOMEN') return path.startsWith('women') || categoryGender === 'WOMEN'
  if (categoryType === 'KIDS_BOYS') return path.includes('kids > boys') || path.startsWith('boys >') || path === 'boys'
  if (categoryType === 'KIDS_GIRLS') return path.includes('kids > girls') || path.startsWith('girls >') || path === 'girls'

  return false
}

function pickValue(row, candidates) {
  const keys = Object.keys(row || {})

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate)
    const matchedKey = keys.find(key => normalizeKey(key) === normalizedCandidate)
    if (matchedKey !== undefined) return row[matchedKey]
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate)
    const matchedKey = keys.find(key => normalizeKey(key).includes(normalizedCandidate))
    if (matchedKey !== undefined) return row[matchedKey]
  }

  return undefined
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const normalized = String(value)
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null

  const match = normalized.match(/-?\d+(\.\d+)?/)
  if (!match) return null

  const number = parseFloat(match[0])
  return Number.isFinite(number) ? number : null
}

function rowHasBannedPhrases(row) {
  const banned = ['inclusive of all taxes', 'brand', 'new in', 'product', '₹0.00']

  const values = Object.values(row || {})
    .map(value => String(value ?? '').toLowerCase().trim())
    .filter(Boolean)

  return values.some(value => banned.some(item => value === item || value.includes(item)))
}

function isDefaultBrandOrProduct(value) {
  const normalized = String(value ?? '').toLowerCase().trim()

  if (!normalized) return true

  const defaults = ['brand', 'product', 'new in', 'inclusive of all taxes']

  return defaults.includes(normalized) || defaults.some(item => normalized.includes(item))
}

function shouldDropRow(row) {
  if (!row || typeof row !== 'object') return true

  const values = Object.values(row).map(value => String(value ?? '').trim())

  if (values.every(value => value === '')) return true

  const brand = pickValue(row, ['brand', 'brand name'])
  const product = pickValue(row, ['product', 'product name', 'name', 'title'])

  const priceValue = pickValue(row, ['price', 'selling price', 'sale price', 'our price', 'sp'])
  const mrpValue = pickValue(row, ['mrp', 'm.r.p', 'list price', 'regular price'])

  const price = toNumber(priceValue)
  const mrp = toNumber(mrpValue)
  const priceIsZero = price !== null && price === 0
  const mrpIsZero = mrp !== null && mrp === 0
  const defaultNames = isDefaultBrandOrProduct(brand) || isDefaultBrandOrProduct(product)

  if (rowHasBannedPhrases(row) && (priceIsZero || mrpIsZero)) return true
  if (priceIsZero && mrpIsZero && defaultNames) return true

  return false
}

function parseCsvLine(line) {
  const columns = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"' && line[index + 1] === '"') {
      current += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === ',' && !inQuotes) {
      columns.push(current)
      current = ''
      continue
    }

    current += character
  }

  columns.push(current)

  return columns
}

function baseNameNoExt(name) {
  const fileName = String(name || '').split('/').pop() || String(name || '')
  const extensionIndex = fileName.lastIndexOf('.')
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
}

function cleanBaseName(name) {
  return baseNameNoExt(name)
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isImagePath(path) {
  const normalized = String(path || '').toLowerCase()
  return normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.png') || normalized.endsWith('.webp')
}

function extractImageTypeFromPath(path) {
  const fullPath = String(path || '')
  const base = cleanBaseName(fullPath)
  const folderPart = fullPath.split('/').slice(0, -1).join(' ')

  if (base.includes('__')) {
    const type = normalizeImageType(base.split('__').slice(1).join('__'))
    if (type) return type
  }

  const suffixMatch = base.match(/(?:__|[_\-. ]+)(front|back|main|f|b)(?:[_\-. ]*\d+)?$/i)

  if (suffixMatch) {
    const type = normalizeImageType(suffixMatch[1])
    if (type) return type
  }

  const prefixMatch = base.match(/^(front|back|main|f|b)(?:__|[_\-. ]+)/i)

  if (prefixMatch) {
    const type = normalizeImageType(prefixMatch[1])
    if (type) return type
  }

  const typeFromName = normalizeImageType(base)
  if (typeFromName) return typeFromName

  const typeFromFolder = normalizeImageType(folderPart)
  if (typeFromFolder) return typeFromFolder

  return 'front'
}

function extractBarcodeFromPath(path) {
  const base = cleanBaseName(path)

  if (base.includes('__')) {
    const barcode = normalizeBarcode(base.split('__')[0])
    if (barcode) return barcode
  }

  const suffixMatch = base.match(/^(.+?)(?:__|[_\-. ]+)(front|back|main|f|b)(?:[_\-. ]*\d+)?$/i)

  if (suffixMatch) {
    const barcode = normalizeBarcode(suffixMatch[1])
    if (barcode) return barcode
  }

  const prefixMatch = base.match(/^(front|back|main|f|b)(?:__|[_\-. ]+)(.+)$/i)

  if (prefixMatch) {
    const barcode = normalizeBarcode(prefixMatch[2])
    if (barcode) return barcode
  }

  const numericMatches = base.match(/[A-Za-z0-9]*\d{5,}[A-Za-z0-9]*/g)

  if (numericMatches?.length) return normalizeBarcode(numericMatches[0])

  return normalizeBarcode(base)
}

function flattenCategories(data) {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data?.tree)
      ? data.tree
      : Array.isArray(data?.categories)
        ? data.categories
        : Array.isArray(data?.rows)
          ? data.rows
          : []

  if (!source.length) return []

  const hasNestedChildren = source.some(item => Array.isArray(item?.children) && item.children.length)

  if (hasNestedChildren) {
    const categories = []

    const walk = (items, parentNames = []) => {
      for (const item of Array.isArray(items) ? items : []) {
        if (!item || item.is_active === false) continue

        const children = (Array.isArray(item.children) ? item.children : []).filter(child => child && child.is_active !== false)
        const names = [...parentNames, item.name].filter(Boolean)
        const path = item.category_path || names.join(' > ')

        categories.push({
          id: String(item.id),
          parent_id: item.parent_id == null ? null : String(item.parent_id),
          gender: String(item.gender || '').toUpperCase(),
          name: item.name,
          slug: item.slug,
          level: Number(item.level) || 0,
          sort_order: Number(item.sort_order) || 0,
          is_active: true,
          category_path: path,
          label: path,
          selectable: children.length === 0 && item.parent_id != null
        })

        if (children.length) walk(children, names)
      }
    }

    walk(source)
    return categories
  }

  const activeRows = source.filter(item => item && item.is_active !== false)
  const byId = new Map()

  activeRows.forEach(item => {
    byId.set(String(item.id), {
      ...item,
      id: String(item.id),
      parent_id: item.parent_id == null ? null : String(item.parent_id),
      children: []
    })
  })

  for (const item of byId.values()) {
    if (item.parent_id && byId.has(String(item.parent_id))) {
      byId.get(String(item.parent_id)).children.push(item)
    }
  }

  const buildPath = item => {
    const names = []
    let current = item
    let guard = 0

    while (current && guard < 20) {
      if (current.name) names.unshift(current.name)
      current = current.parent_id ? byId.get(String(current.parent_id)) : null
      guard += 1
    }

    return item.category_path || names.join(' > ')
  }

  return Array.from(byId.values()).map(item => {
    const children = item.children.filter(child => child && child.is_active !== false)
    const path = buildPath(item)

    return {
      id: String(item.id),
      parent_id: item.parent_id == null ? null : String(item.parent_id),
      gender: String(item.gender || '').toUpperCase(),
      name: item.name,
      slug: item.slug,
      level: Number(item.level) || 0,
      sort_order: Number(item.sort_order) || 0,
      is_active: true,
      category_path: path,
      label: path,
      selectable: children.length === 0 && item.parent_id != null
    }
  })
}

async function cleanExcelOrCsvFile(inputFile) {
  const name = inputFile?.name || ''
  const lowerName = name.toLowerCase()

  if (lowerName.endsWith('.csv')) {
    const text = await inputFile.text()

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')

    if (!lines.length) return inputFile

    const headers = parseCsvLine(lines[0]).map(header => header.trim().replace(/^"|"$/g, ''))
    const rows = []

    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index]
      if (!line?.trim()) continue

      const columns = parseCsvLine(line)
      const row = {}

      headers.forEach((header, columnIndex) => {
        row[header] = columns[columnIndex] ?? ''
      })

      if (!shouldDropRow(row)) rows.push(row)
    }

    const escapeValue = value => {
      const normalized = String(value ?? '')

      if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n') || normalized.includes('\r')) {
        return `"${normalized.replace(/"/g, '""')}"`
      }

      return normalized
    }

    const outputLines = [headers.map(escapeValue).join(',')]

    for (const row of rows) {
      outputLines.push(headers.map(header => escapeValue(row[header])).join(','))
    }

    const blob = new Blob([outputLines.join('\n')], { type: 'text/csv' })

    return new File([blob], inputFile.name, { type: inputFile.type || 'text/csv' })
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const xlsxModule = await import('xlsx')
    const XLSX = xlsxModule.default || xlsxModule
    const buffer = await inputFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames?.[0]

    if (!sheetName) return inputFile

    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    const filteredRows = (Array.isArray(rows) ? rows : []).filter(row => !shouldDropRow(row))
    const outputWorkbook = XLSX.utils.book_new()
    const outputWorksheet = XLSX.utils.json_to_sheet(filteredRows.length ? filteredRows : [])

    XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, sheetName)

    const output = XLSX.write(outputWorkbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    return new File([blob], inputFile.name, { type: blob.type })
  }

  return inputFile
}

export default function ImportStock() {
  const { user } = useAuth()
  const { show, hide } = useLoading()

  const [file, setFile] = useState(null)
  const [imageZip, setImageZip] = useState(null)
  const [categoryType, setCategoryType] = useState('')
  const [gender, setGender] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [allCategories, setAllCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [message, setMessage] = useState('')
  const [imageMessage, setImageMessage] = useState('')
  const [jobs, setJobs] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState(null)

  const [imageProgress, setImageProgress] = useState({
    done: 0,
    total: 0
  })

  const [matchStats, setMatchStats] = useState({
    matched: 0,
    total: 0,
    skipped: 0
  })

  const [unmatchedList, setUnmatchedList] = useState([])
  const [b2cDiscount, setB2cDiscount] = useState('')
  const [b2bDiscount, setB2bDiscount] = useState('')
  const [savingDiscounts, setSavingDiscounts] = useState(false)
  const [discountMessage, setDiscountMessage] = useState('')

  const branchId = useMemo(() => {
    const savedBranchId =
      typeof window !== 'undefined'
        ? localStorage.getItem('branch_id') || localStorage.getItem('branchId')
        : null

    return (
      normalizeBranchId(user?.branch_id) ||
      normalizeBranchId(user?.branchId) ||
      normalizeBranchId(user?.branch?.id) ||
      normalizeBranchId(savedBranchId) ||
      DEFAULT_BRANCH_ID
    )
  }, [user])

  const categories = useMemo(
    () =>
      allCategories
        .filter(category => matchesCategoryType(category, categoryType) && category.selectable && category.is_active)
        .sort((a, b) => {
          const pathCompare = String(a.category_path).localeCompare(String(b.category_path), undefined, { numeric: true })

          if (pathCompare !== 0) return pathCompare

          return a.sort_order - b.sort_order
        }),
    [allCategories, categoryType]
  )

  const categoryMap = useMemo(
    () => new Map(allCategories.map(category => [String(category.id), category])),
    [allCategories]
  )

  const selectedCategory = useMemo(
    () => categories.find(category => String(category.id) === String(categoryId)) || null,
    [categories, categoryId]
  )

  const canUpload = useMemo(
    () =>
      Boolean(
        file &&
          branchId &&
          categoryType &&
          gender &&
          categoryId &&
          selectedCategory &&
          selectedCategory.selectable &&
          selectedCategory.is_active &&
          !uploading &&
          !loadingCategories
      ),
    [file, branchId, categoryType, gender, categoryId, selectedCategory, uploading, loadingCategories]
  )

  const canUploadImages = useMemo(
    () => Boolean(imageZip && branchId && !uploadingImages),
    [imageZip, branchId, uploadingImages]
  )

  const canSaveDiscounts = useMemo(
    () =>
      Boolean(
        branchId &&
          !savingDiscounts &&
          b2cDiscount !== '' &&
          b2bDiscount !== '' &&
          Number.isFinite(parseFloat(b2cDiscount)) &&
          Number.isFinite(parseFloat(b2bDiscount))
      ),
    [branchId, savingDiscounts, b2cDiscount, b2bDiscount]
  )

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true)
    setCategoryError('')

    const endpoints = ['/api/categories/tree', '/api/product-categories/tree', '/api/categories']

    try {
      let loaded = []
      let lastError = null

      for (const endpoint of endpoints) {
        try {
          const response = await apiGet(endpoint)
          const flattened = flattenCategories(response)

          if (flattened.length) {
            loaded = flattened
            break
          }
        } catch (error) {
          lastError = error
        }
      }

      setAllCategories(loaded)

      if (!loaded.length) {
        setCategoryId('')
        setCategoryError(lastError?.payload?.message || lastError?.message || 'No active categories available')
      }
    } catch (error) {
      setAllCategories([])
      setCategoryId('')
      setCategoryError(error?.payload?.message || error?.message || 'Failed to load categories')
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  const fetchJobs = useCallback(async () => {
    if (!branchId) return

    setRefreshing(true)
    show()

    try {
      const data = await apiGet(`/api/branch/${encodeURIComponent(branchId)}/import-jobs`)
      setJobs(Array.isArray(data) ? data : [])
    } catch {
      setJobs([])
    } finally {
      setRefreshing(false)
      hide()
    }
  }, [branchId, show, hide])

  const fetchDiscounts = useCallback(async () => {
    if (!branchId) return

    try {
      const data = await apiGet(`/api/branch/${encodeURIComponent(branchId)}/discounts`)

      if (data && typeof data === 'object') {
        if (data.b2c_discount_pct !== undefined && data.b2c_discount_pct !== null) {
          setB2cDiscount(String(data.b2c_discount_pct))
        }

        if (data.b2b_discount_pct !== undefined && data.b2b_discount_pct !== null) {
          setB2bDiscount(String(data.b2b_discount_pct))
        }
      }
    } catch {
      setB2cDiscount('')
      setB2bDiscount('')
    }
  }, [branchId])

  useEffect(() => {
    const savedType = localStorage.getItem('import_category_type') || ''
    const savedGender = localStorage.getItem('import_gender') || ''
    const initialType = savedType || (savedGender === 'MEN' || savedGender === 'WOMEN' ? savedGender : '')

    setCategoryType(initialType)
    setGender(getGenderFromCategoryType(initialType))
    localStorage.setItem('branch_id', String(branchId))
  }, [branchId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    fetchDiscounts()
  }, [fetchDiscounts])

  useEffect(() => {
    if (!categoryType || loadingCategories) {
      if (!categoryType) setCategoryId('')
      return
    }

    const currentCategory = categories.find(category => String(category.id) === String(categoryId))

    if (currentCategory) return

    const savedCategoryId =
      localStorage.getItem(`import_category_id_${categoryType}`) ||
      localStorage.getItem(`import_category_id_${gender}`) ||
      ''

    const savedCategory = categories.find(category => String(category.id) === String(savedCategoryId))

    setCategoryId(savedCategory ? String(savedCategory.id) : '')
  }, [categoryType, gender, categoryId, categories, loadingCategories])

  const processJob = useCallback(
    async (jobId, setProg) => {
      let start = 0
      let finished = false

      setProg({
        jobId,
        state: 'Processing…',
        done: 0,
        total: null
      })

      while (!finished) {
        const response = await apiPost(
          `/api/branch/${encodeURIComponent(branchId)}/import/process/${jobId}?start=${start}&limit=${PROCESS_LIMIT}`
        )

        const processed = Number(response?.processed || 0)
        const next =
          response?.nextStart !== undefined && response?.nextStart !== null
            ? Number(response.nextStart)
            : start + processed

        const total =
          response?.totalRows !== undefined && response?.totalRows !== null
            ? Number(response.totalRows)
            : null

        const safeNext = Number.isFinite(next) ? next : start + processed
        const doneCount = total !== null ? Math.min(safeNext, total) : safeNext

        setProg({
          jobId,
          state: response?.done ? 'Completed' : 'Processing…',
          done: doneCount,
          total
        })

        if (response?.done || processed <= 0 || safeNext <= start) {
          finished = true
        } else {
          start = safeNext
        }
      }
    },
    [branchId]
  )

  const getJobCategoryLabel = useCallback(
    job => {
      if (job?.category_path) return job.category_path

      const category = categoryMap.get(String(job?.category_id || ''))

      if (category?.category_path) return category.category_path

      return [job?.parent_category_name, job?.category_name].filter(Boolean).join(' > ') || '-'
    },
    [categoryMap]
  )

  const onCategoryTypeChange = value => {
    const nextGender = getGenderFromCategoryType(value)

    setCategoryType(value)
    setGender(nextGender)
    setCategoryId('')
    setMessage('')

    localStorage.setItem('import_category_type', value || '')
    localStorage.setItem('import_gender', nextGender || '')
  }

  const onCategoryChange = value => {
    const category = categories.find(item => String(item.id) === String(value))

    const nextValue = category?.selectable && category?.is_active ? String(category.id) : ''

    setCategoryId(nextValue)
    setMessage('')

    if (categoryType) {
      localStorage.setItem(`import_category_id_${categoryType}`, nextValue)
    }

    if (gender) {
      localStorage.setItem(`import_category_id_${gender}`, nextValue)
    }
  }

  const onUpload = useCallback(
    async event => {
      event.preventDefault()

      if (!branchId) {
        setMessage('Branch not found')
        return
      }

      if (!file || !categoryType || !gender || !categoryId || !selectedCategory || !selectedCategory.selectable || !selectedCategory.is_active) {
        setMessage('Please select category type, selectable product category and choose a file.')
        return
      }

      setUploading(true)
      setMessage('')
      setProgress(null)
      show()

      try {
        const cleanedFile = await cleanExcelOrCsvFile(file)
        const formData = new FormData()

        formData.append('file', cleanedFile)
        formData.append('gender', gender)
        formData.append('category_id', String(selectedCategory.id))

        localStorage.setItem('import_category_type', categoryType)
        localStorage.setItem('import_gender', gender)
        localStorage.setItem(`import_category_id_${categoryType}`, String(selectedCategory.id))
        localStorage.setItem(`import_category_id_${gender}`, String(selectedCategory.id))
        localStorage.setItem('branch_id', String(branchId))

        const job = await apiUpload(`/api/branch/${encodeURIComponent(branchId)}/import`, formData)

        setMessage('Uploaded. Starting processing…')
        setFile(null)

        await processJob(job.id, setProgress)
        await fetchJobs()
      } catch (error) {
        setMessage(error?.payload?.message || error?.message || 'Upload failed')
      } finally {
        setUploading(false)
        hide()
        setTimeout(() => setMessage(''), 3000)
      }
    },
    [file, branchId, categoryType, gender, categoryId, selectedCategory, show, hide, processJob, fetchJobs]
  )

  async function uploadToCloudinary(blob, publicIdBase) {
    const formData = new FormData()
    const uniquePublicId = `${publicIdBase}__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    formData.append('file', blob)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder', 'products')
    formData.append('public_id', uniquePublicId)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.error?.message || `Cloudinary upload failed (${response.status})`)
    }

    return data
  }

  const onUploadImages = useCallback(
    async event => {
      event.preventDefault()

      if (!branchId) {
        setImageMessage('Branch not found')
        return
      }

      if (!imageZip) {
        setImageMessage('Please choose a ZIP file.')
        return
      }

      setUploadingImages(true)
      setImageMessage('')
      setImageProgress({ done: 0, total: 0 })
      setMatchStats({ matched: 0, total: 0, skipped: 0 })
      setUnmatchedList([])
      show()

      try {
        localStorage.setItem('branch_id', String(branchId))

        const zip = await JSZip.loadAsync(imageZip)
        const entries = Object.values(zip.files).filter(entry => !entry.dir && isImagePath(entry.name))
        const total = entries.length

        let done = 0
        let uploadedCount = 0
        const unmatched = []
        const uploadedImages = []
        const seenImageKeys = new Set()

        for (const entry of entries) {
          const barcode = extractBarcodeFromPath(entry.name)
          const imageType = extractImageTypeFromPath(entry.name)
          const imageKey = `${barcode}__${imageType}`

          if (!barcode) {
            unmatched.push({
              file: entry.name,
              barcode: '(none)',
              reason: 'Barcode not found in filename'
            })

            done += 1
            setImageProgress({ done, total })
            continue
          }

          if (!imageType || !['front', 'back'].includes(imageType)) {
            unmatched.push({
              file: entry.name,
              barcode,
              reason: 'Image type must be front or back'
            })

            done += 1
            setImageProgress({ done, total })
            continue
          }

          if (seenImageKeys.has(imageKey)) {
            unmatched.push({
              file: entry.name,
              barcode,
              reason: `Duplicate ${imageType} image`
            })

            done += 1
            setImageProgress({ done, total })
            continue
          }

          seenImageKeys.add(imageKey)

          const blob = await entry.async('blob')
          const uploaded = await uploadToCloudinary(blob, `${barcode}__${imageType}`)

          uploadedImages.push({
            barcode,
            image_type: imageType,
            secure_url: uploaded.secure_url || uploaded.url || '',
            public_id: uploaded.public_id || '',
            original_filename: entry.name
          })

          uploadedCount += 1
          done += 1
          setImageProgress({ done, total })
        }

        let saved = 0
        let serverUnmatched = []

        if (uploadedImages.length) {
          const confirmation = await apiPost(`/api/branch/${encodeURIComponent(branchId)}/images/confirm`, {
            images: uploadedImages
          })

          saved = Number(confirmation?.totalUpdated || 0)
          serverUnmatched = Array.isArray(confirmation?.unmatched) ? confirmation.unmatched : []
        }

        const finalUnmatched = [
          ...unmatched,
          ...serverUnmatched.map(item => ({
            file: item.original_filename || '',
            barcode: item.barcode || '(none)',
            reason: item.reason || 'Not saved'
          }))
        ]

        setMatchStats({
          matched: saved,
          total,
          skipped: finalUnmatched.length
        })

        setUnmatchedList(finalUnmatched)
        setImageMessage(`Finished. Uploaded ${uploadedCount}/${total}. Saved ${saved}. Unmatched ${finalUnmatched.length}.`)
        setImageZip(null)
      } catch (error) {
        setImageMessage(error?.payload?.message || error?.message || 'Image upload failed')
      } finally {
        setUploadingImages(false)
        hide()
        setTimeout(() => setImageMessage(''), 5000)
      }
    },
    [imageZip, branchId, show, hide]
  )

  const onSaveDiscounts = useCallback(
    async event => {
      event.preventDefault()

      if (!branchId) {
        setDiscountMessage('Branch not found')
        return
      }

      const b2c = parseFloat(b2cDiscount)
      const b2b = parseFloat(b2bDiscount)

      if (!Number.isFinite(b2c) || !Number.isFinite(b2b) || b2c < 0 || b2b < 0 || b2c > 100 || b2b > 100) {
        setDiscountMessage('Enter valid discount percentages between 0 and 100')
        return
      }

      setSavingDiscounts(true)
      setDiscountMessage('')
      show()

      try {
        localStorage.setItem('branch_id', String(branchId))

        await apiPost(`/api/branch/${encodeURIComponent(branchId)}/discounts`, {
          b2c_discount_pct: b2c,
          b2b_discount_pct: b2b
        })

        setDiscountMessage('Discounts saved successfully')
      } catch (error) {
        setDiscountMessage(error?.payload?.message || error?.message || 'Failed to save discounts')
      } finally {
        setSavingDiscounts(false)
        hide()
        setTimeout(() => setDiscountMessage(''), 4000)
      }
    },
    [branchId, b2cDiscount, b2bDiscount, show, hide]
  )

  return (
    <div className="import-page-admin">
      <Navbar />

      <div className="import-wrap-admin">
        <div className="import-card-admin">
          <div className="import-title-admin">Import Stock (Excel)</div>

          <div className="import-subtitle-admin">
            Select category type, product category and upload the Excel file. Every barcode is treated as one unique SKU.
          </div>

          <form className="import-form-admin" onSubmit={event => event.preventDefault()}>
            <div className="excel-block">
              <div className="category-flow-grid">
                <div className="select-wrap">
                  <label className="label">Category Type</label>

                  <select
                    className={`audience-select ${categoryType ? '' : 'invalid'}`}
                    value={categoryType}
                    onChange={event => onCategoryTypeChange(event.target.value)}
                    required
                  >
                    <option value="">Select Category Type</option>

                    {CATEGORY_TYPES.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="select-wrap">
                  <label className="label">Product Category</label>

                  <select
                    className={`audience-select ${selectedCategory ? '' : 'invalid'}`}
                    value={categoryId}
                    onChange={event => onCategoryChange(event.target.value)}
                    disabled={!categoryType || loadingCategories || Boolean(categoryError)}
                    required
                  >
                    <option value="">
                      {loadingCategories
                        ? 'Loading categories...'
                        : categoryError
                          ? 'Categories unavailable'
                          : categoryType
                            ? 'Select Product Category'
                            : 'Select Category Type First'}
                    </option>

                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>

                  {categoryError ? <div className="import-filehint-admin">{categoryError}</div> : null}
                </div>
              </div>

              <div className="import-filebox-admin">
                <label className="label">Excel / CSV</label>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={event => setFile(event.target.files?.[0] || null)}
                />

                {file ? (
                  <div className="import-filehint-admin">
                    {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                ) : (
                  <div className="import-filehint-admin">No file selected</div>
                )}

                <button type="button" className="import-btn-admin" onClick={onUpload} disabled={!canUpload}>
                  {uploading ? 'Uploading…' : 'Upload Excel'}
                </button>

                {message ? <div className="import-msg-admin">{message}</div> : null}

                {progress ? (
                  <div className="import-msg-admin">
                    {progress.state}{' '}
                    {progress.total !== null ? `${progress.done}/${progress.total}` : `${progress.done}+`} rows
                  </div>
                ) : null}
              </div>

              <div className="inline-info">
                <span className={`pill-mini ${categoryType ? 'ok' : 'warn'}`}>
                  {categoryType ? `Category Type: ${getCategoryTypeLabel(categoryType)}` : 'Select category type'}
                </span>

                <span className={`pill-mini ${selectedCategory ? 'ok' : 'warn'}`}>
                  {selectedCategory ? `Product Category: ${selectedCategory.category_path}` : 'Select product category'}
                </span>
              </div>
            </div>
          </form>
        </div>

        <div className="import-card-admin">
          <div className="import-title-admin">Upload Product Images (ZIP by Barcode)</div>

          <div className="import-subtitle-admin">
            Use barcode__front.jpg and barcode__back.jpg. Also supported: barcode_front.jpg, barcode-back.jpg, barcode.front.jpg, barcode back.jpg, front_barcode.jpg and back_barcode.jpg.
          </div>

          <form className="import-form-admin" onSubmit={event => event.preventDefault()}>
            <div className="zip-block">
              <div className="import-filebox-admin">
                <label className="label">Images ZIP Folder</label>

                <input
                  type="file"
                  accept=".zip"
                  onChange={event => setImageZip(event.target.files?.[0] || null)}
                />

                {imageZip ? (
                  <div className="import-filehint-admin">
                    {imageZip.name} • {(imageZip.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                ) : (
                  <div className="import-filehint-admin">No ZIP selected</div>
                )}

                <button type="button" className="import-btn-admin" onClick={onUploadImages} disabled={!canUploadImages}>
                  {uploadingImages ? `Uploading ${imageProgress.done}/${imageProgress.total}…` : 'Upload Images ZIP'}
                </button>

                {imageMessage ? <div className="import-msg-admin">{imageMessage}</div> : null}

                <div className="image-stats">
                  <span>Saved: {matchStats.matched}</span>
                  <span>Unmatched: {matchStats.skipped}</span>
                  <span>Total: {matchStats.total}</span>
                </div>

                {unmatchedList.length > 0 ? (
                  <div className="unmatched-wrap">
                    <div className="unmatched-title">Unmatched / Skipped Images</div>

                    <ul className="unmatched-list">
                      {unmatchedList.map((item, index) => (
                        <li key={`${item.file}-${index}`}>
                          <span className="unmatched-ean">{item.barcode}</span>
                          <span className="unmatched-file">
                            {item.file}
                            {item.reason ? ` - ${item.reason}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <div className="import-card-admin">
          <div className="import-title-admin">B2C / B2B Discounts</div>

          <div className="import-subtitle-admin">
            Set discount percentages for all products in this branch. These are kept separate from Excel and image uploads.
          </div>

          <form className="import-form-admin" onSubmit={onSaveDiscounts}>
            <div className="discount-block">
              <div className="discount-row">
                <div className="discount-field">
                  <label className="label">B2C Discount (%)</label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={b2cDiscount}
                    onChange={event => setB2cDiscount(event.target.value)}
                    className="discount-input"
                  />
                </div>

                <div className="discount-field">
                  <label className="label">B2B Discount (%)</label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={b2bDiscount}
                    onChange={event => setB2bDiscount(event.target.value)}
                    className="discount-input"
                  />
                </div>
              </div>

              <button type="submit" className="import-btn-admin" disabled={!canSaveDiscounts}>
                {savingDiscounts ? 'Saving…' : 'Save Discounts'}
              </button>

              {discountMessage ? <div className="import-msg-admin">{discountMessage}</div> : null}
            </div>
          </form>
        </div>

        <div className="import-card-admin">
          <div className="import-title-admin">Recent Imports</div>

          <div className="import-actions-admin">
            <button type="button" className="import-ghost-btn-admin" onClick={fetchJobs} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="import-tablewrap-admin">
            <table className="import-table-admin">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>File</th>
                  <th>Gender</th>
                  <th>Product Category</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Error</th>
                  <th>Uploaded</th>
                  <th>Completed</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="import-row-card">
                    <td data-label="ID">{job.id}</td>
                    <td data-label="File">{job.file_name || '-'}</td>
                    <td data-label="Gender">{job.gender || '-'}</td>
                    <td data-label="Product Category">{getJobCategoryLabel(job)}</td>
                    <td data-label="Status">
                      <span className={`pill-admin ${String(job.status_enum || '').toLowerCase()}`}>
                        {job.status_enum || '-'}
                      </span>
                    </td>
                    <td data-label="Total">{job.rows_total ?? 0}</td>
                    <td data-label="Success">{job.rows_success ?? 0}</td>
                    <td data-label="Error">{job.rows_error ?? 0}</td>
                    <td data-label="Uploaded">{job.uploaded_at ? new Date(job.uploaded_at).toLocaleString() : '-'}</td>
                    <td data-label="Completed">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}

                {!jobs.length ? (
                  <tr>
                    <td colSpan="10" className="import-empty-admin">
                      No imports yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="import-note-admin">Each upload affects only your branch inventory.</div>
        </div>
      </div>
    </div>
  )
}