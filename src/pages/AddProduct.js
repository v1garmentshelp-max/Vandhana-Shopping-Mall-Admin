import React, { useEffect, useState } from 'react'
import './AddProduct.css'
import { useAuth } from './AdminAuth'
import { useLoading } from './LoadingContext'
import { apiGet, apiUpload, apiPost } from './api'

const AddProduct = () => {
  const { user } = useAuth()
  const { show, hide } = useLoading()
  const branchId = user?.branch_id

  const [brandList, setBrandList] = useState([])
  const [productList, setProductList] = useState([])
  const [colorList, setColorList] = useState([])
  const [kidsSizes, setKidsSizes] = useState([])
  const [adultSizes, setAdultSizes] = useState([])

  const [loadingOptions, setLoadingOptions] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState('')
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

  const [popupMessage, setPopupMessage] = useState('')
  const [popupType, setPopupType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true)
      try {
        const data = await apiGet('/api/products?limit=10000')
        const list = Array.isArray(data) ? data : []
        const brandSet = new Set()
        const productSet = new Set()
        const colorSet = new Set()
        const sizeSet = new Set()
        list.forEach(item => {
          if (item.brand) brandSet.add(item.brand)
          if (item.product_name) productSet.add(item.product_name)
          if (item.color) colorSet.add(item.color)
          if (item.size) sizeSet.add(item.size)
        })
        const brands = Array.from(brandSet).sort()
        const products = Array.from(productSet).sort()
        const colors = Array.from(colorSet).sort()
        const allSizes = Array.from(sizeSet)
        const kids = []
        const adults = []
        allSizes.forEach(size => {
          if (/^\d/.test(size)) kids.push(size)
          else adults.push(size)
        })
        const fallbackKids = [
          'Below 1 year', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9',
          '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'
        ]
        const fallbackAdults = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
        setBrandList(brands)
        setProductList(products)
        setColorList(colors.length ? colors : ['Red', 'Blue', 'Green', 'Black', 'White', 'Gold'])
        setKidsSizes(kids.length ? kids : fallbackKids)
        setAdultSizes(adults.length ? adults : fallbackAdults)
      } catch (e) {
        const fallbackKids = [
          'Below 1 year', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9',
          '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'
        ]
        const fallbackAdults = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
        setBrandList([])
        setProductList([])
        setColorList(['Red', 'Blue', 'Green', 'Black', 'White', 'Gold'])
        setKidsSizes(fallbackKids)
        setAdultSizes(fallbackAdults)
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

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

  const mapCategoryToGender = category => {
    if (category === 'Men') return 'MEN'
    if (category === 'Women') return 'WOMEN'
    if (category === 'Kids - Boys' || category === 'Kids - Girls') return 'KIDS'
    return ''
  }

  const resetForm = () => {
    setSelectedCategory('')
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

    try {
      setSubmitting(true)
      show()
      const job = await apiUpload(`/api/branch/${encodeURIComponent(branchId)}/import`, formData)
      if (!job || !job.id) {
        throw new Error('Import job not created')
      }
      await processJob(branchId, job.id)
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
    setNewBrand('')
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