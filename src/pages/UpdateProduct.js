import React, { useState, useEffect, useMemo } from 'react';
import './UpdateProduct.css';

const DEFAULT_API_BASE = 'https://vandhana-shopping-mall-backend.vercel.app';
const DEFAULT_ASSETS_BASE = 'https://vandhana-shopping-mall-backend.vercel.app/uploads';

const API_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE;

const ASSETS_BASE_RAW =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ASSETS_BASE) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_ASSETS_BASE) ||
  DEFAULT_ASSETS_BASE;

const API_BASE = API_BASE_RAW.replace(/\/+$/, '');
const ASSETS_BASE = ASSETS_BASE_RAW.replace(/\/+$/, '');

const normalizeAssetUrl = (maybeRelative) => {
  if (!maybeRelative) return '';
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  const base = ASSETS_BASE || API_BASE;
  if (!base) return maybeRelative;
  const needsSlash = !maybeRelative.startsWith('/');
  return `${base}${needsSlash ? '/' : ''}${maybeRelative}`;
};

const coerceNumber = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : 0;
};

const toCategoryLabel = (value) => {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'women' || s === "women's" || s === 'ladies' || s === 'female') return 'Women';
  if (s === 'men' || s === "men's" || s === 'mens' || s === 'male') return 'Men';
  if (s.startsWith('kid') || s === 'boys' || s === 'girls' || s === 'children') return 'Kids';
  return String(value || '').trim();
};

const rowFromApi = (p) => {
  const id = p.id || p.product_id || p._id || p.uuid;
  return {
    id,
    category: toCategoryLabel(p.category || p.gender || ''),
    brand: p.brand || '',
    product_name: p.product_name || '',
    color: p.color || '',
    size: p.size || '',
    original_price_b2b: coerceNumber(p.original_price_b2b),
    discount_b2b: coerceNumber(p.discount_b2b),
    final_price_b2b: coerceNumber(p.final_price_b2b),
    original_price_b2c: coerceNumber(p.original_price_b2c),
    discount_b2c: coerceNumber(p.discount_b2c),
    final_price_b2c: coerceNumber(p.final_price_b2c),
    total_count: coerceNumber(p.total_count ?? p.available_qty ?? p.on_hand),
    image_url: normalizeAssetUrl(p.image_url || p.image || p.imageUrl || p.path || ''),
    newImageFile: null,
    preview_url: '',
    dirty: false
  };
};

const computeFinal = (price, discount) => {
  const p = coerceNumber(price);
  const d = coerceNumber(discount);
  return Number((p - (p * d) / 100).toFixed(2));
};

const getItemsFromResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const getHasMoreFromResponse = (data, itemsLength, limit, page) => {
  if (typeof data?.hasMore === 'boolean') return data.hasMore;
  if (typeof data?.has_next === 'boolean') return data.has_next;
  if (typeof data?.nextPage === 'number') return data.nextPage > page;
  if (typeof data?.next_page === 'number') return data.next_page > page;
  if (typeof data?.totalPages === 'number') return page < data.totalPages;
  if (typeof data?.total_pages === 'number') return page < data.total_pages;
  if (typeof data?.total === 'number') return page * limit < data.total;
  if (typeof data?.count === 'number') return page * limit < data.count;
  return itemsLength === limit;
};

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return await res.json();
};

const fetchAllProducts = async () => {
  const directUrls = [
    `${API_BASE}/api/products?all=true`,
    `${API_BASE}/api/products?limit=50000`,
    `${API_BASE}/api/products`
  ];

  for (const url of directUrls) {
    try {
      const data = await fetchJson(url);
      const items = getItemsFromResponse(data);
      if (Array.isArray(items) && items.length > 200) {
        return items.map(rowFromApi);
      }
    } catch {}
  }

  const pageSize = 1000;
  let page = 1;
  let hasMore = true;
  const all = [];
  const seen = new Set();

  while (hasMore) {
    const pageUrls = [
      `${API_BASE}/api/products?page=${page}&limit=${pageSize}`,
      `${API_BASE}/api/products?page=${page}&pageSize=${pageSize}`,
      `${API_BASE}/api/products?page=${page}&per_page=${pageSize}`,
      `${API_BASE}/api/products?offset=${(page - 1) * pageSize}&limit=${pageSize}`
    ];

    let pageItems = [];
    let responseData = null;

    for (const url of pageUrls) {
      try {
        const data = await fetchJson(url);
        const items = getItemsFromResponse(data);
        if (Array.isArray(items) && items.length > 0) {
          pageItems = items;
          responseData = data;
          break;
        }
      } catch {}
    }

    if (!pageItems.length) break;

    let addedThisRound = 0;

    for (const item of pageItems) {
      const mapped = rowFromApi(item);
      const key = String(mapped.id ?? `${mapped.product_name}-${mapped.color}-${mapped.size}`);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(mapped);
        addedThisRound += 1;
      }
    }

    if (addedThisRound === 0) break;

    hasMore = getHasMoreFromResponse(responseData, pageItems.length, pageSize, page);
    page += 1;

    if (page > 100000) break;
  }

  if (all.length > 0) return all;

  for (const url of directUrls) {
    try {
      const data = await fetchJson(url);
      const items = getItemsFromResponse(data);
      if (Array.isArray(items) && items.length > 0) {
        return items.map(rowFromApi);
      }
    } catch {}
  }

  return [];
};

const UpdateProduct = () => {
  const [rows, setRows] = useState([]);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState('');
  const [popupConfirm, setPopupConfirm] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const mapped = await fetchAllProducts();
      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    return () => {
      rows.forEach((r) => {
        if (r.preview_url) URL.revokeObjectURL(r.preview_url);
      });
    };
  }, [rows]);

  const rowIndexById = useMemo(() => {
    const map = new Map();
    rows.forEach((r, i) => map.set(r.id, i));
    return map;
  }, [rows]);

  const updateField = (index, field, value) => {
    if (index < 0) return;
    setRows((prev) => {
      const next = [...prev];
      const current = { ...next[index] };

      if (field === 'category') {
        current[field] = toCategoryLabel(value);
      } else if (
        field === 'original_price_b2b' ||
        field === 'discount_b2b' ||
        field === 'original_price_b2c' ||
        field === 'discount_b2c' ||
        field === 'total_count'
      ) {
        current[field] = value === '' ? '' : coerceNumber(value);
      } else {
        current[field] = value;
      }

      if (field === 'original_price_b2b' || field === 'discount_b2b') {
        current.final_price_b2b = computeFinal(current.original_price_b2b, current.discount_b2b);
      }

      if (field === 'original_price_b2c' || field === 'discount_b2c') {
        current.final_price_b2c = computeFinal(current.original_price_b2c, current.discount_b2c);
      }

      current.dirty = true;
      next[index] = current;
      return next;
    });
  };

  const handleImageChange = (index, file) => {
    if (!file || index < 0) return;
    setRows((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      if (current.preview_url) URL.revokeObjectURL(current.preview_url);
      current.newImageFile = file;
      current.preview_url = URL.createObjectURL(file);
      current.dirty = true;
      next[index] = current;
      return next;
    });
  };

  const filteredSortedRows = useMemo(() => {
    let list = rows;

    if (filter === 'Men') list = list.filter((r) => String(r.category).toLowerCase() === 'men');
    else if (filter === 'Women') list = list.filter((r) => String(r.category).toLowerCase() === 'women');
    else if (filter === 'Kids') list = list.filter((r) => String(r.category).toLowerCase().startsWith('kids'));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        String(r.brand || '').toLowerCase().includes(q) ||
        String(r.product_name || '').toLowerCase().includes(q) ||
        String(r.color || '').toLowerCase().includes(q) ||
        String(r.size || '').toLowerCase().includes(q) ||
        String(r.category || '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];

    if (sortBy === 'recent') sorted.sort((a, b) => coerceNumber(b.id) - coerceNumber(a.id));
    else if (sortBy === 'price_b2c_asc') sorted.sort((a, b) => computeFinal(a.original_price_b2c, a.discount_b2c) - computeFinal(b.original_price_b2c, b.discount_b2c));
    else if (sortBy === 'price_b2c_desc') sorted.sort((a, b) => computeFinal(b.original_price_b2c, b.discount_b2c) - computeFinal(a.original_price_b2c, a.discount_b2c));
    else if (sortBy === 'stock_desc') sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count));
    else if (sortBy === 'brand_asc') sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')));

    return sorted;
  }, [rows, filter, search, sortBy]);

  const dirtyRows = useMemo(() => rows.filter((r) => r.dirty), [rows]);

  const validationErrors = useMemo(() => {
    const errors = [];

    dirtyRows.forEach((p) => {
      const missing = [];

      if (!p.id) missing.push('id');
      if (!String(p.category || '').trim()) missing.push('category');
      if (!String(p.brand || '').trim()) missing.push('brand');
      if (!String(p.product_name || '').trim()) missing.push('product name');
      if (!String(p.color || '').trim()) missing.push('color');
      if (!String(p.size || '').trim()) missing.push('size');
      if (p.original_price_b2b === '' || p.original_price_b2b === null || p.original_price_b2b === undefined) missing.push('original price b2b');
      if (p.discount_b2b === '' || p.discount_b2b === null || p.discount_b2b === undefined) missing.push('discount b2b');
      if (p.original_price_b2c === '' || p.original_price_b2c === null || p.original_price_b2c === undefined) missing.push('original price b2c');
      if (p.discount_b2c === '' || p.discount_b2c === null || p.discount_b2c === undefined) missing.push('discount b2c');
      if (p.total_count === '' || p.total_count === null || p.total_count === undefined) missing.push('stock');
      if (!(p.image_url || p.preview_url || p.newImageFile)) missing.push('image');

      if (missing.length) {
        errors.push({
          id: p.id,
          name: p.product_name || `Row ${p.id}`,
          fields: missing
        });
      }
    });

    return errors;
  }, [dirtyRows]);

  const validateDirty = () => dirtyRows.length > 0 && validationErrors.length === 0;

  const handleUpdateClick = () => {
    if (!dirtyRows.length) {
      setPopupMessage('No changes to update');
      setPopupType('error');
      setTimeout(() => setPopupMessage(''), 2200);
      return;
    }

    if (!validateDirty()) {
      const first = validationErrors[0];
      const details = first ? `Missing in ${first.name}: ${first.fields.join(', ')}` : 'Please complete all required fields in edited rows';
      setPopupMessage(details);
      setPopupType('error');
      setTimeout(() => setPopupMessage(''), 3200);
      return;
    }

    setPopupConfirm(true);
  };

  const uploadImageIfNeeded = async (r) => {
    if (!r.newImageFile) return r.image_url;
    const formData = new FormData();
    formData.append('image', r.newImageFile);
    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    const data = await res.json();
    return normalizeAssetUrl(data.imageUrl || data.url || data.path);
  };

  const persistRow = async (r) => {
    const image_url = await uploadImageIfNeeded(r);
    const payload = {
      category: r.category,
      brand: r.brand,
      product_name: r.product_name,
      color: r.color,
      size: r.size,
      original_price_b2b: coerceNumber(r.original_price_b2b),
      discount_b2b: coerceNumber(r.discount_b2b),
      final_price_b2b: computeFinal(r.original_price_b2b, r.discount_b2b),
      original_price_b2c: coerceNumber(r.original_price_b2c),
      discount_b2c: coerceNumber(r.discount_b2c),
      final_price_b2c: computeFinal(r.original_price_b2c, r.discount_b2c),
      total_count: Math.max(0, Math.floor(coerceNumber(r.total_count))),
      image_url
    };

    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(r.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Update failed ${res.status}`);

    const updated = await res.json().catch(() => payload);

    return {
      ...r,
      ...updated,
      category: toCategoryLabel(updated.category || updated.gender || r.category),
      total_count: coerceNumber(updated.total_count ?? updated.available_qty ?? payload.total_count),
      image_url,
      newImageFile: null,
      preview_url: '',
      dirty: false
    };
  };

  const confirmUpdate = async (confirmed) => {
    setPopupConfirm(false);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedMap = new Map();

      for (const r of rows) {
        if (!r.dirty) continue;
        const u = await persistRow(r);
        updatedMap.set(r.id, u);
      }

      const next = rows.map((r) => updatedMap.get(r.id) || r);
      setRows(next);
      setPopupMessage('Changes saved successfully');
      setPopupType('success');
      setTimeout(() => setPopupMessage(''), 2200);
    } catch {
      setPopupMessage('Error saving changes');
      setPopupType('error');
      setTimeout(() => setPopupMessage(''), 2600);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCount = rows.length;
  const visibleCount = filteredSortedRows.length;
  const editedCount = dirtyRows.length;

  return (
    <div className="update-product-page-vandana">
      <div className="update-topbar-vandana">
        <div className="topbar-left-vandana">
          <div className="title-wrap-vandana">
            <p className="page-kicker-vandana">Product Control</p>
            <h1>Update Products</h1>
            <p className="page-subtitle-vandana">Edit pricing, stock, images and product details in one place.</p>
          </div>

          <div className="summary-strip-vandana">
            <div className="summary-chip-vandana">
              <span>Total</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="summary-chip-vandana">
              <span>Visible</span>
              <strong>{visibleCount}</strong>
            </div>
            <div className="summary-chip-vandana active-vandana">
              <span>Edited</span>
              <strong>{editedCount}</strong>
            </div>
          </div>
        </div>

        <div className="topbar-right-vandana">
          <button className="ghost-btn-vandana" onClick={fetchAll} disabled={isLoading || isSaving}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="toolbar-card-vandana">
        <div className="filters-vandana">
          {['All', 'Men', 'Women', 'Kids'].map((f) => (
            <button key={f} className={`filter-pill-vandana ${filter === f ? 'active-vandana' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <div className="toolbar-right-vandana">
          <input
            className="search-input-vandana"
            placeholder="Search by brand, product, color, size or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select-vandana" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="price_b2c_asc">Price B2C: Low to High</option>
            <option value="price_b2c_desc">Price B2C: High to Low</option>
            <option value="stock_desc">Stock: High to Low</option>
            <option value="brand_asc">Brand: A to Z</option>
          </select>
        </div>
      </div>

      <div className="table-panel-vandana">
        <div className="table-panel-head-vandana">
          <div>
            <h2>Product Table</h2>
            <p>{editedCount ? `${editedCount} row${editedCount > 1 ? 's' : ''} have unsaved changes` : 'Everything is up to date'}</p>
          </div>
        </div>

        <div className="table-scroll-wrapper-vandana">
          <table className="table-vandana">
            <thead>
              <tr>
                <th>Sl. No</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Color</th>
                <th>Size</th>
                <th>Original Price (B2B)</th>
                <th>Discount % (B2B)</th>
                <th>Final Price (B2B)</th>
                <th>Original Price (B2C)</th>
                <th>Discount % (B2C)</th>
                <th>Final Price (B2C)</th>
                <th>Stock</th>
                <th>Image</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedRows.map((product, idx) => {
                const rowIndex = rowIndexById.get(product.id);
                return (
                  <tr key={product.id || idx} className={product.dirty ? 'dirty-row-vandana' : ''}>
                    <td className="serial-cell-vandana">{idx + 1}</td>

                    <td>
                      <select
                        className="table-select-vandana"
                        value={product.category}
                        onChange={(e) => updateField(rowIndex, 'category', e.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                        <option value="Kids">Kids</option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="text"
                        value={product.brand}
                        onChange={(e) => updateField(rowIndex, 'brand', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={product.product_name}
                        onChange={(e) => updateField(rowIndex, 'product_name', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={product.color}
                        onChange={(e) => updateField(rowIndex, 'color', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={product.size}
                        onChange={(e) => updateField(rowIndex, 'size', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={product.original_price_b2b}
                        onChange={(e) => updateField(rowIndex, 'original_price_b2b', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={product.discount_b2b}
                        onChange={(e) => updateField(rowIndex, 'discount_b2b', e.target.value)}
                      />
                    </td>

                    <td>
                      <div className="readonly-value-vandana">{computeFinal(product.original_price_b2b, product.discount_b2b).toFixed(2)}</div>
                    </td>

                    <td>
                      <input
                        type="number"
                        value={product.original_price_b2c}
                        onChange={(e) => updateField(rowIndex, 'original_price_b2c', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={product.discount_b2c}
                        onChange={(e) => updateField(rowIndex, 'discount_b2c', e.target.value)}
                      />
                    </td>

                    <td>
                      <div className="readonly-value-vandana">{computeFinal(product.original_price_b2c, product.discount_b2c).toFixed(2)}</div>
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        value={product.total_count}
                        onChange={(e) => updateField(rowIndex, 'total_count', e.target.value)}
                      />
                    </td>

                    <td>
                      <div className="image-stack-vandana">
                        <img
                          src={product.preview_url || product.image_url || 'https://via.placeholder.com/76x76?text=No+Image'}
                          alt="product"
                          className="table-image-vandana"
                        />
                        <label className="upload-btn-vandana">
                          Replace
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(rowIndex, e.target.files && e.target.files[0])}
                          />
                        </label>
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge-vandana ${product.dirty ? 'edited-vandana' : 'saved-vandana'}`}>
                        {product.dirty ? 'Edited' : 'Saved'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {!filteredSortedRows.length && (
                <tr>
                  <td colSpan="15" className="empty-state-cell-vandana">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="floating-savebar-vandana">
        <div className="floating-savebar-left-vandana">
          <span className="floating-label-vandana">Unsaved changes</span>
          <strong className="floating-value-vandana">{editedCount} row{editedCount !== 1 ? 's' : ''} edited</strong>
        </div>

        <div className="floating-savebar-right-vandana">
          <button className="ghost-btn-vandana" onClick={fetchAll} disabled={isLoading || isSaving}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="primary-btn-vandana" onClick={handleUpdateClick} disabled={!dirtyRows.length || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {popupMessage && (
        <div className={`popup-toast-vandana ${popupType}`}>
          {popupMessage}
        </div>
      )}

      {popupConfirm && (
        <div className="popup-overlay-vandana">
          <div className="confirm-modal-vandana">
            <h3>Save changes</h3>
            <p>Do you want to save all edited rows now?</p>
            <div className="modal-actions-vandana">
              <button className="primary-btn-vandana" onClick={() => confirmUpdate(true)}>Yes, Save</button>
              <button className="ghost-btn-vandana" onClick={() => confirmUpdate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateProduct;