import React, { useEffect, useMemo, useState } from 'react'
import './AddProduct.css'
import { useAuth } from './AdminAuth'
import { useLoading } from './LoadingContext'
import { apiGet, apiUpload, apiPost } from './api'

const DEFAULT_BRANCH_ID = 3

const PATTERN_TYPE_OPTIONS = [
  'AOP',
  'CHECKED',
  'FEATHER PRINT',
  'FLORAL',
  'GRAPHIC PRINT',
  'OMBRE',
  'PLAIN',
  'PRINTED',
  'PUFF PRINT',
  'SOLID',
  'TEXTURED'
]

const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizeDesignCode = value =>
  cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9._-]/g, '')
    .slice(0, 100)

const normalizePatternType = value => cleanText(value).toUpperCase().slice(0, 100)

const getProductItems = data => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.data)) return data.data
  return []
}

const flattenCategories = data => {
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

  const nested = source.some(item => Array.isArray(item?.children) && item.children.length)

  if (nested) {
    const result = []

    const walk = (items, parents = []) => {
      for (const item of Array.isArray(items) ? items : []) {
        if (!item || item.is_active === false) continue

        const children = (Array.isArray(item.children) ? item.children : []).filter(
          child => child && child.is_active !== false
        )
        const names = [...parents, item.name].filter(Boolean)
        const path = item.category_path || names.join(' > ')

        result.push({
          id: String(item.id),
          parent_id: item.parent_id == null ? null : String(item.parent_id),
          gender: cleanText(item.gender).toUpperCase(),
          name: item.name,
          slug: item.slug,
          category_path: path,
          label: path,
          selectable: children.length === 0 && item.parent_id != null
        })

        if (children.length) walk(children, names)
      }
    }

    walk(source)
    return result
  }

  const rows = source.filter(item => item && item.is_active !== false)
  const byId = new Map(
    rows.map(item => [
      String(item.id),
      {
        ...item,
        id: String(item.id),
        parent_id: item.parent_id == null ? null : String(item.parent_id),
        children: []
      }
    ])
  )

  for (const item of byId.values()) {
    if (item.parent_id && byId.has(item.parent_id)) {
      byId.get(item.parent_id).children.push(item)
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
      parent_id: item.parent_id,
      gender: cleanText(item.gender).toUpperCase(),
      name: item.name,
      slug: item.slug,
      category_path: path,
      label: path,
      selectable: children.length === 0 && item.parent_id != null
    }
  })
}

const mapCategoryToGender = category => {
  if (category === 'Men') return 'MEN'
  if (category === 'Women') return 'WOMEN'
  if (category === 'Kids - Boys' || category === 'Kids - Girls') return 'KIDS'
  return ''
}

const AddProduct = () => {
  const { user } = useAuth()
  const { show, hide } = useLoading()
  const branchId =
    user?.branch_id ||
    (typeof window !== 'undefined' ? localStorage.getItem('branch_id') : null) ||
    DEFAULT_BRANCH_ID

  const [brandList, setBrandList] = useState([])
  const [productList, setProductList] = useState([])
  const [colorList, setColorList] = useState([])
  const [kidsSizes, setKidsSizes] = useState([])
  const [adultSizes, setAdultSizes] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])

  const [loadingOptions, setLoadingOptions] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [brandInput, setBrandInput] = useState('')
  const [filteredBrands, setFilteredBrands] = useState([])
  const [showDropdownBrand, setShowDropdownBrand] = useState(false)
  const [showPopupBrand, setShowPopupBrand] = useState(false)
  const [newBrand, setNewBrand] = useState('')

  const [productInput, setProductInput] = useState('')
  const [filteredProducts, setFilteredProducts] = useState([])
  const [showDropdownProduct, setShowDropdownProduct] = useState(false)
  const [showPopupProduct, setShowPopupProduct] = useState(false)
  const [newProduct, setNewProduct] = useState('')

  const [originalPriceB2B, setOriginalPriceB2B] = useState('')
  const [discountB2B, setDiscountB2B] = useState('')
  const [finalPriceB2B, setFinalPriceB2B] = useState('')

  const [originalPriceB2C, setOriginalPriceB2C] = useState('')
  const [discountB2C, setDiscountB2C] = useState('')
  const [finalPriceB2C, setFinalPriceB2C] = useState('')

  const [totalCount, setTotalCount] = useState('')

  const [selectedColor, setSelectedColor] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [uploadedImage, setUploadedImage] = useState('')

  const [eanCode, setEanCode] = useState('')
  const [designCode, setDesignCode] = useState('')
  const [patternType, setPatternType] = useState('')
  const [patternCode, setPatternCode] = useState('')

  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true)
      const fallbackKids = [
        'Below 1 year', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9',
        '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'
      ]
      const fallbackAdults = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

      try {
        const [productData, categoryData] = await Promise.all([
          apiGet('/api/products?limit=10000&all=true'),
          apiGet('/api/categories/tree')
        ])
        const list = getProductItems(productData)
        const brandSet = new Set()
        const productSet = new Set()
        const colorSet = new Set()
        const sizeSet = new Set()

        list.forEach(item => {
          const brand = cleanText(item.brand || item.brand_name)
          const productName = cleanText(item.product_name || item.name)
          if (brand) brandSet.add(brand)
          if (productName) productSet.add(productName)

          const variants = Array.isArray(item.variants)
            ? item.variants
            : Array.isArray(item.color_variants)
              ? item.color_variants
              : [item]

          variants.forEach(variant => {
            const color = cleanText(variant.color || variant.colour)
            const size = cleanText(variant.size)
            if (color) colorSet.add(color)
            if (size) sizeSet.add(size)
          })
        })

        const allSizes = Array.from(sizeSet)
        const kids = []
        const adults = []

        allSizes.forEach(size => {
          if (/^\d/.test(size) || /year/i.test(size)) kids.push(size)
          else adults.push(size)
        })

        setBrandList(Array.from(brandSet).sort())
        setProductList(Array.from(productSet).sort())
        setColorList(Array.from(colorSet).sort().length ? Array.from(colorSet).sort() : ['Red', 'Blue', 'Green', 'Black', 'White', 'Gold'])
        setKidsSizes(kids.length ? kids.sort() : fallbackKids)
        setAdultSizes(adults.length ? adults.sort() : fallbackAdults)
        setCategoryOptions(flattenCategories(categoryData))
      } catch (error) {
        setBrandList([])
        setProductList([])
        setColorList(['Red', 'Blue', 'Green', 'Black', 'White', 'Gold'])
        setKidsSizes(fallbackKids)
        setAdultSizes(fallbackAdults)
        setCategoryOptions([])
      } finally {
        setLoadingOptions(false)
      }
    }

    loadOptions()
  }, [])

  const availableCategories = useMemo(() => {
    const gender = mapCategoryToGender(selectedCategory)
    if (!gender) return []

    return categoryOptions
      .filter(category => {
        if (!category.selectable || category.gender !== gender) return false
        const path = cleanText(category.category_path || category.label).toLowerCase()
        if (selectedCategory === 'Kids - Boys') return path.includes('boy') && !path.includes('girl')
        if (selectedCategory === 'Kids - Girls') return path.includes('girl')
        return true
      })
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))
  }, [categoryOptions, selectedCategory])

  const handlePriceChangeB2B = value => {
    setOriginalPriceB2B(value)
    const price = parseFloat(value)
    const disc = parseFloat(discountB2B)
    if (!isNaN(price) && !isNaN(disc)) {
      setFinalPriceB2B((price - (price * disc) / 100).toFixed(2))
    } else {
      setFinalPriceB2B('')
    }
  }

  const handleDiscountChangeB2B = value => {
    setDiscountB2B(value)
    const price = parseFloat(originalPriceB2B)
    const disc = parseFloat(value)
    if (!isNaN(price) && !isNaN(disc)) {
      setFinalPriceB2B((price - (price * disc) / 100).toFixed(2))
    } else {
      setFinalPriceB2B('')
    }
  }

  const handlePriceChangeB2C = value => {
    setOriginalPriceB2C(value)
    const price = parseFloat(value)
    const disc = parseFloat(discountB2C)
    if (!isNaN(price) && !isNaN(disc)) {
      setFinalPriceB2C((price - (price * disc) / 100).toFixed(2))
    } else {
      setFinalPriceB2C('')
    }
  }

  const handleDiscountChangeB2C = value => {
    setDiscountB2C(value)
    const price = parseFloat(originalPriceB2C)
    const disc = parseFloat(value)
    if (!isNaN(price) && !isNaN(disc)) {
      setFinalPriceB2C((price - (price * disc) / 100).toFixed(2))
    } else {
      setFinalPriceB2C('')
    }
  }

  const handleImageUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      show()
      const data = await apiUpload('/api/upload', formData)
      const url = data.imageUrl || data.url || data.path || ''
      setUploadedImage(url)
    } catch (err) {
      setPopupMessage('Image upload failed')
      setPopupType('error')
    } finally {
      hide()
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
    }
  }

  const resetForm = () => {
    setSelectedCategory('')
    setSelectedCategoryId('')
    setBrandInput('')
    setProductInput('')
    setSelectedColor('')
    setSelectedSize('')
    setOriginalPriceB2B('')
    setDiscountB2B('')
    setFinalPriceB2B('')
    setOriginalPriceB2C('')
    setDiscountB2C('')
    setFinalPriceB2C('')
    setTotalCount('')
    setUploadedImage('')
    setEanCode('')
    setDesignCode('')
    setPatternType('')
    setPatternCode('')
  }

  const processJob = async (branchIdValue, jobId) => {
    let start = 0
    for (;;) {
      const r = await apiPost(
        `/api/branch/${encodeURIComponent(branchIdValue)}/import/process/${jobId}?start=${start}&limit=200`,
        {}
      )
      const next = r.nextStart ?? (start + (r.processed || 0))
      if (r.done) break
      start = next
    }
  }

  const handleAddProduct = async () => {
    const ean = eanCode.trim()
    if (!/^[0-9]{13}$/.test(ean)) {
      setPopupMessage('EAN code must be exactly 13 digits.')
      setPopupType('error')
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
      return
    }

    if (
      !selectedCategory ||
      !selectedCategoryId ||
      !brandInput.trim() ||
      !productInput.trim() ||
      !selectedColor ||
      !selectedSize ||
      !originalPriceB2B ||
      !discountB2B ||
      !finalPriceB2B ||
      !originalPriceB2C ||
      !discountB2C ||
      !finalPriceB2C ||
      !totalCount ||
      !uploadedImage
    ) {
      setPopupMessage('Please fill all the required fields.')
      setPopupType('error')
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
      return
    }

    if (!branchId) {
      setPopupMessage('Branch not found. Please login again.')
      setPopupType('error')
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
      return
    }

    const normalizedDesignCode = normalizeDesignCode(designCode)
    const normalizedPatternType = normalizePatternType(patternType)
    const gender = mapCategoryToGender(selectedCategory)
    if (!gender) {
      setPopupMessage('Please select a valid category.')
      setPopupType('error')
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
      return
    }

    const csvHeaders = [
      'productname',
      'brandname',
      'designcode',
      'patterntype',
      'pattern',
      'size',
      'colour',
      'eancode',
      'mrp',
      'rsaleprice',
      'costprice',
      'purchaseqty',
      'b2cdiscount',
      'b2bdiscount'
    ]

    const safe = value => String(value ?? '').replace(/"/g, '""')

    const csvRow = [
      safe(productInput),
      safe(brandInput),
      safe(normalizedDesignCode),
      safe(normalizedPatternType),
      safe(patternCode),
      safe(selectedSize),
      safe(selectedColor),
      ean,
      safe(originalPriceB2C),
      safe(finalPriceB2C),
      safe(originalPriceB2B),
      safe(totalCount),
      safe(discountB2C),
      safe(discountB2B)
    ]

    const csv =
      csvHeaders.join(',') +
      '\n' +
      csvRow.map(v => `"${v}"`).join(',')

    const blob = new Blob([csv], { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', blob, 'manual-product.csv')
    formData.append('gender', gender)
    formData.append('category_id', selectedCategoryId)

    try {
      setSubmitting(true)
      show()
      const job = await apiUpload(`/api/branch/${encodeURIComponent(branchId)}/import`, formData)
      if (!job || !job.id) {
        throw new Error('Import job not created')
      }
      await processJob(branchId, job.id)
      await apiPost(`/api/branch/${encodeURIComponent(branchId)}/images/confirm`, {
        images: [
          {
            barcode: ean,
            image_type: 'front',
            image_url: uploadedImage,
            secure_url: uploadedImage,
            public_id: '',
            original_filename: `${ean}__front`
          }
        ]
      })
      setPopupMessage('Product added successfully.')
      setPopupType('success')
      resetForm()
    } catch (error) {
      const message =
        error?.payload?.message ||
        error?.message ||
        'Failed to add product.'
      setPopupMessage(message)
      setPopupType('error')
    } finally {
      setSubmitting(false)
      hide()
      setTimeout(() => {
        setPopupMessage('')
        setPopupType('')
      }, 3000)
    }
  }

  const handleCategorySelect = category => {
    setSelectedCategory(category)
    setSelectedCategoryId('')
  }

  const handleBrandSearch = e => {
    const value = e.target.value
    setBrandInput(value)
    if (!value && !brandList.length) {
      setShowDropdownBrand(false)
      return
    }
    const filtered = brandList.filter(brand =>
      brand.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredBrands(filtered)
    setShowDropdownBrand(true)
  }

  const handleBrandSelect = brand => {
    setBrandInput(brand)
    setShowDropdownBrand(false)
  }

  const handleAddNewBrand = () => {
    const value = newBrand.trim()
    if (value && !brandList.includes(value)) {
      const updated = [...brandList, value].sort()
      setBrandList(updated)
      setBrandInput(value)
    }
    setNewBrand('')
    setShowPopupBrand(false)
    setShowDropdownBrand(false)
  }

  const handleProductSearch = e => {
    const value = e.target.value
    setProductInput(value)
    if (!value && !productList.length) {
      setShowDropdownProduct(false)
      return
    }
    const filtered = productList.filter(product =>
      product.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredProducts(filtered)
    setShowDropdownProduct(true)
  }

  const handleProductSelect = product => {
    setProductInput(product)
    setShowDropdownProduct(false)
  }

  const handleAddNewProduct = () => {
    const value = newProduct.trim()
    if (value && !productList.includes(value)) {
      const updated = [...productList, value].sort()
      setProductList(updated)
      setProductInput(value)
    }
    setNewProduct('')
    setShowPopupProduct(false)
    setShowDropdownProduct(false)
  }

  return (
    <div className="add-product-page">
      <div className="admin-section1">
        <div className="section-header">
          <h2>Product Category</h2>
          {loadingOptions && <span className="chip">Loading options...</span>}
        </div>
        <div className="category-buttons">
          {['Men', 'Women', 'Kids - Boys', 'Kids - Girls'].map(category => (
            <button
              key={category}
              className={selectedCategory === category ? 'active' : ''}
              onClick={() => handleCategorySelect(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="row-two">
        <div className="admin-section2">
          <h2>Brand</h2>
          <input
            type="text"
            placeholder="Search or type brand"
            value={brandInput}
            onChange={handleBrandSearch}
            onFocus={() => {
              if (brandList.length) {
                setFilteredBrands(brandList)
                setShowDropdownBrand(true)
              }
            }}
            className="text-input"
          />
          {showDropdownBrand && filteredBrands.length > 0 && (
            <div className="dropdown">
              {filteredBrands.map(brand => (
                <div
                  key={brand}
                  className="dropdown-item"
                  onClick={() => handleBrandSelect(brand)}
                >
                  {brand}
                </div>
              ))}
            </div>
          )}
          <button
            className="pill-button"
            onClick={() => setShowPopupBrand(true)}
          >
            Add New Brand
          </button>
        </div>

        <div className="admin-section3">
          <h2>Product Name</h2>
          <input
            type="text"
            placeholder="Search or type product"
            value={productInput}
            onChange={handleProductSearch}
            onFocus={() => {
              if (productList.length) {
                setFilteredProducts(productList)
                setShowDropdownProduct(true)
              }
            }}
            className="text-input"
          />
          {showDropdownProduct && filteredProducts.length > 0 && (
            <div className="dropdown">
              {filteredProducts.map(product => (
                <div
                  key={product}
                  className="dropdown-item"
                  onClick={() => handleProductSelect(product)}
                >
                  {product}
                </div>
              ))}
            </div>
          )}
          <button
            className="pill-button"
            onClick={() => setShowPopupProduct(true)}
          >
            Add New Product
          </button>
        </div>
      </div>

      <div className="row-two">
        <div className="admin-section2">
          <h2>Sub-category</h2>
          <select
            className="text-input"
            value={selectedCategoryId}
            onChange={event => setSelectedCategoryId(event.target.value)}
            disabled={!selectedCategory || loadingOptions}
          >
            <option value="">Select product sub-category</option>
            {availableCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <span className="hint">Active leaf category is required</span>
        </div>

        <div className="admin-section3">
          <h2>Design Details</h2>
          <input
            type="text"
            className="text-input"
            placeholder="Design code, optional"
            value={designCode}
            onChange={event => setDesignCode(normalizeDesignCode(event.target.value))}
            maxLength={100}
          />
          <input
            type="text"
            className="text-input"
            placeholder="Pattern type, optional"
            list="pattern-type-options"
            value={patternType}
            onChange={event => setPatternType(normalizePatternType(event.target.value))}
            maxLength={100}
          />
          <datalist id="pattern-type-options">
            {PATTERN_TYPE_OPTIONS.map(option => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <input
            type="text"
            className="text-input"
            placeholder="Legacy pattern code, optional"
            value={patternCode}
            onChange={event => setPatternCode(event.target.value.slice(0, 100))}
            maxLength={100}
          />
          <span className="hint">Design code is generated by the backend when left blank</span>
        </div>
      </div>

      {showPopupBrand && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Add a New Brand</h3>
            <input
              type="text"
              placeholder="Enter new brand name"
              value={newBrand}
              onChange={e => setNewBrand(e.target.value)}
              className="text-input"
            />
            <div className="popup-actions">
              <button onClick={handleAddNewBrand}>Add Brand</button>
              <button onClick={() => setShowPopupBrand(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPopupProduct && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Add a New Product</h3>
            <input
              type="text"
              placeholder="Enter new product name"
              value={newProduct}
              onChange={e => setNewProduct(e.target.value)}
              className="text-input"
            />
            <div className="popup-actions">
              <button onClick={handleAddNewProduct}>Add Product</button>
              <button onClick={() => setShowPopupProduct(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-section4-final">
        <div className="section-header">
          <h2>Details</h2>
        </div>

        <div className="grid-two">
          <div className="field-group">
            <label className="field-label">EAN Code</label>
            <input
              type="text"
              className="text-input"
              placeholder="13 digit EAN code"
              value={eanCode}
              onChange={e => setEanCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 13))}
            />
            <span className="hint">Must be exactly 13 digits</span>
          </div>

          <div className="field-group">
            <label className="field-label">Color</label>
            <div className="pill-grid">
              {colorList.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`pill-option ${selectedColor === color ? 'active' : ''}`}
                  onClick={() => setSelectedColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-two">
          <div className="field-group">
            <label className="field-label">Kids Sizes</label>
            <div className="pill-grid">
              {kidsSizes.map(size => (
                <button
                  key={size}
                  type="button"
                  className={`pill-option ${selectedSize === size ? 'active' : ''}`}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Adult Sizes</label>
            <div className="pill-grid">
              {adultSizes.map(size => (
                <button
                  key={size}
                  type="button"
                  className={`pill-option ${selectedSize === size ? 'active' : ''}`}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="price-table-wrap">
          <table className="price-table">
            <thead>
              <tr>
                <th></th>
                <th>B2B</th>
                <th>B2C</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Original Price</td>
                <td>
                  <input
                    type="number"
                    value={originalPriceB2B}
                    onChange={e => handlePriceChangeB2B(e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={originalPriceB2C}
                    onChange={e => handlePriceChangeB2C(e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td>Discount (%)</td>
                <td>
                  <input
                    type="number"
                    value={discountB2B}
                    onChange={e => handleDiscountChangeB2B(e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={discountB2C}
                    onChange={e => handleDiscountChangeB2C(e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td>Final Price</td>
                <td>
                  <input type="number" value={finalPriceB2B} readOnly />
                </td>
                <td>
                  <input type="number" value={finalPriceB2C} readOnly />
                </td>
              </tr>
              <tr>
                <td>Total Count</td>
                <td colSpan="2" className="centered-input">
                  <input
                    type="number"
                    value={totalCount}
                    onChange={e => setTotalCount(e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="image-upload">
          <label className="upload-btn">
            Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </label>
          {uploadedImage ? (
            <img src={uploadedImage} alt="Uploaded" className="preview-image" />
          ) : (
            <span className="hint">No image selected</span>
          )}
        </div>
      </div>

      <div className="admin-section5">
        <button
          className="add-product-btn"
          onClick={handleAddProduct}
          disabled={submitting}
        >
          {submitting ? 'Adding Product...' : 'Add Product'}
        </button>
      </div>

      {popupMessage && (
        <div className={`popup-card ${popupType}`}>
          {popupMessage}
        </div>
      )}
    </div>
  )
}

export default AddProduct