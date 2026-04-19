import React, { useEffect, useMemo, useState } from 'react';
import './DeleteProduct.css';

const DEFAULT_API_BASE = 'https://taras-kart-backend.vercel.app';
const DEFAULT_ASSETS_BASE = 'https://taras-kart-backend.vercel.app/uploads';

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

const coerceNumber = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '').trim());
  return Number.isFinite(n) ? n : 0;
};

const normalizeAssetUrl = (maybeRelative) => {
  if (!maybeRelative) return '';
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  const base = ASSETS_BASE || API_BASE;
  const needsSlash = !maybeRelative.startsWith('/');
  return `${base}${needsSlash ? '/' : ''}${maybeRelative}`;
};

const computeFinal = (price, discount) => {
  const p = coerceNumber(price);
  const d = coerceNumber(discount);
  return Number((p - (p * d) / 100).toFixed(2));
};

const mapRow = (p) => ({
  id: p.id || p.product_id || p._id || p.uuid,
  category: p.category || '',
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
  total_count: coerceNumber(p.total_count),
  image_url: normalizeAssetUrl(p.image_url || p.image || p.imageUrl || p.path || '')
});

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
  if (!res.ok) throw new Error('Request failed');
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
      if (Array.isArray(items) && items.length > 1000) {
        return items.map(mapRow);
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
      const mapped = mapRow(item);
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

    if (page > 1000) break;
  }

  if (all.length > 0) return all;

  for (const url of directUrls) {
    try {
      const data = await fetchJson(url);
      const items = getItemsFromResponse(data);
      if (Array.isArray(items) && items.length > 0) {
        return items.map(mapRow);
      }
    } catch {}
  }

  return [];
};

const DeleteProduct = () => {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [isLoading, setIsLoading] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState('');
  const [confirmIds, setConfirmIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const allRows = await fetchAllProducts();
      setRows(allRows);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredSortedRows = useMemo(() => {
    let list = rows;

    if (filter === 'Men') list = list.filter((r) => r.category.toLowerCase() === 'men');
    else if (filter === 'Women') list = list.filter((r) => r.category.toLowerCase() === 'women');
    else if (filter === 'Kids') list = list.filter((r) => r.category.toLowerCase().startsWith('kids'));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.brand || '').toLowerCase().includes(q) ||
          (r.product_name || '').toLowerCase().includes(q) ||
          (r.color || '').toLowerCase().includes(q) ||
          (r.size || '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];

    if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const av = Number(a.id) || 0;
        const bv = Number(b.id) || 0;
        return bv - av;
      });
    } else if (sortBy === 'price_b2c_asc') {
      sorted.sort(
        (a, b) => computeFinal(a.original_price_b2c, a.discount_b2c) - computeFinal(b.original_price_b2c, b.discount_b2c)
      );
    } else if (sortBy === 'price_b2c_desc') {
      sorted.sort(
        (a, b) => computeFinal(b.original_price_b2c, b.discount_b2c) - computeFinal(a.original_price_b2c, a.discount_b2c)
      );
    } else if (sortBy === 'stock_desc') {
      sorted.sort((a, b) => coerceNumber(b.total_count) - coerceNumber(a.total_count));
    } else if (sortBy === 'brand_asc') {
      sorted.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')));
    }

    return sorted;
  }, [rows, filter, search, sortBy]);

  const askDelete = (ids) => {
    if (!ids.length) {
      setPopupMessage('Select at least one product');
      setPopupType('error');
      setTimeout(() => setPopupMessage(''), 1800);
      return;
    }
    setConfirmIds(ids);
    setShowConfirm(true);
  };

  const confirmDelete = async (ok) => {
    setShowConfirm(false);
    if (!ok) return;

    try {
      await Promise.all(
        confirmIds.map((id) =>
          fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
        )
      );

      setRows((prev) => prev.filter((r) => !confirmIds.includes(r.id)));
      setSelectedIds(new Set());
      setPopupMessage('Deleted successfully');
      setPopupType('success');
      setTimeout(() => setPopupMessage(''), 1800);
    } catch {
      setPopupMessage('Failed to delete some items');
      setPopupType('error');
      setTimeout(() => setPopupMessage(''), 2000);
    } finally {
      setConfirmIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredSortedRows.map((r) => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  return (
    <div className="delete-product-page">
      <div className="delete-toolbar">
        <div className="filters">
          {['All', 'Men', 'Women', 'Kids'].map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <div className="tools">
          <input
            className="search-input"
            placeholder="Search by brand, product, color, size"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="price_b2c_asc">Price B2C: Low to High</option>
            <option value="price_b2c_desc">Price B2C: High to Low</option>
            <option value="stock_desc">Stock: High to Low</option>
            <option value="brand_asc">Brand: A → Z</option>
          </select>

          <button className="refresh-btn" onClick={fetchAll} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>

          <button className="danger-btn" onClick={() => askDelete(Array.from(selectedIds))}>
            Delete Selected
          </button>
        </div>
      </div>

      <div className="delete-section2">
        <h2>Product Table ({filteredSortedRows.length})</h2>
        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={toggleSelectAllVisible}
                    checked={
                      filteredSortedRows.length > 0 &&
                      filteredSortedRows.every((r) => selectedIds.has(r.id))
                    }
                    aria-label="Select all visible"
                  />
                </th>
                <th>Sl. No</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Color</th>
                <th>Size</th>
                <th>Original Price (B2C)</th>
                <th>Discount % (B2C)</th>
                <th>Final Price (B2C)</th>
                <th>Stock</th>
                <th>Image</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedRows.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      aria-label={`Select ${p.product_name}`}
                    />
                  </td>
                  <td>{idx + 1}</td>
                  <td>{p.category}</td>
                  <td>{p.brand}</td>
                  <td>{p.product_name}</td>
                  <td>{p.color}</td>
                  <td>{p.size}</td>
                  <td>{p.original_price_b2c}</td>
                  <td>{p.discount_b2c}</td>
                  <td>{computeFinal(p.original_price_b2c, p.discount_b2c).toFixed(2)}</td>
                  <td>{p.total_count}</td>
                  <td>
                    <img src={p.image_url} alt="product" className="table-image" />
                  </td>
                  <td>
                    <button className="delete-btn" onClick={() => askDelete([p.id])}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredSortedRows.length && (
                <tr>
                  <td colSpan="13" style={{ padding: 16, color: 'gold' }}>
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popupMessage && <div className={`popup-card ${popupType}`}>{popupMessage}</div>}

      {showConfirm && (
        <div className="popup-confirm-box centered-popup">
          <p>{confirmIds.length > 1 ? `Delete ${confirmIds.length} products?` : 'Delete this product?'}</p>
          <div className="popup-actions">
            <button onClick={() => confirmDelete(true)}>Yes</button>
            <button onClick={() => confirmDelete(false)}>No</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteProduct;