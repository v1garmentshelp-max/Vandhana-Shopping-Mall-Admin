import React, { useEffect, useState } from 'react';
import Navbar from './NavbarAdmin';
import { apiGet } from './api';
import './ShiwangOffer.css';
const money = value => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
export default function ShiwangOffer() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    apiGet('/storefront/admin/offers/shiwang', {}, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => { const timer = setInterval(() => setRefresh(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  return <><Navbar /><main className="shiwang-admin"><div className="shiwang-admin-heading"><div><p>RETAIL PROMOTIONS</p><h1>Shiwang pair offer</h1></div><button disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p role="alert">{error}</p>}{loading && !data && <p role="status">Loading offer…</p>}
    {data && <><section className="shiwang-admin-card"><strong className="shiwang-admin-status">{data.offer.status}</strong><h2>Women · Kurthi Pant Set · Shiwang</h2><p>15–20 October 2026 (India time). Ends automatically at midnight starting 21 October.</p><div className="shiwang-admin-prices">{[1,2,3,4].map(q => <div key={q}>{q} set{q > 1 ? 's' : ''}<b>{money(Math.floor(q / 2) * data.offer.pair_price + q % 2 * data.offer.single_price)}</b></div>)}</div><p>Mix eligible products, colours and sizes in the same retail order. Every pair saves ₹381. Shipping, COD fees and rewards use the existing checkout policy.</p><p>Offer pricing is enforced by the backend. Stored catalogue prices, wholesale and POS pricing are unchanged. No database migration is required.</p></section>
      <section className="shiwang-admin-card"><h2>Matching variants · Branch {data.branch_id}</h2><p>{data.products.length} matching variants · {data.products.filter(p => p.active && Number(p.available) > 0).length} in stock.</p>{!data.products.length && <p role="alert">No matching products found. Check brand, gender and category in Products before promoting this offer.</p>}<div className="shiwang-admin-table"><table><thead><tr><th>Product / variant</th><th>Category</th><th>Size / colour</th><th>Saved price</th><th>Offer single</th><th>Stock</th></tr></thead><tbody>{data.products.map(p => <tr key={p.variant_id}><td>{p.name}<small>Product {p.product_id} · Variant {p.variant_id}</small></td><td>{[...p.category_names].reverse().join(' › ')}</td><td>{p.size} / {p.colour}</td><td>{money(Number(p.b2c_discount_pct) > 0 ? Number(p.mrp) * (1 - Number(p.b2c_discount_pct) / 100) : p.sale_price || p.mrp)}</td><td>{data.offer.active ? money(data.offer.single_price) : 'Inactive'}</td><td>{p.active ? p.available : 'Inactive'}</td></tr>)}</tbody></table></div></section></>}
  </main></>;
}
