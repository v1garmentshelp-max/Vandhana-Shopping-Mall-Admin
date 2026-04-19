import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './NavbarAdmin';
import { useAuth } from './AdminAuth';
import './POS.css';

const DEFAULT_API_BASE = 'https://taras-kart-backend.vercel.app';
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE) ||
  DEFAULT_API_BASE;

const uuid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);

export default function POS() {
  const { token, user } = useAuth();
  const branchId = user?.branch_id || user?.branchId || null;

  const eanInputRef = useRef(null);

  const [saleId, setSaleId] = useState(uuid());
  const [ean, setEan] = useState('');
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');
  const [searching, setSearching] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    eanInputRef.current?.focus();
  }, []);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const totals = useMemo(() => {
    let qty = 0;
    let total = 0;
    for (const it of items) {
      qty += it.qty;
      total += it.qty * Number(it.price || 0);
    }
    return { qty, total };
  }, [items]);

  const scanFlow = async (code) => {
    const trimmed = String(code || '').trim();
    if (!trimmed) return;
    if (!branchId) {
      showToast('No branch selected');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        showToast('Product not found');
        return;
      }
      const v = await res.json();
      const price = Number(v?.sale_price ?? v?.mrp ?? 0);
      const img = v?.image_url || '';
      const variantId = Number(v?.variant_id);

      const reserve = await fetch(`${API_BASE}/api/inventory/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch_id: branchId,
          ean_code: trimmed,
          qty: 1,
          sale_id: saleId,
          client_action_id: uuid(),
        }),
      });
      if (!reserve.ok) {
        const j = await reserve.json().catch(() => ({}));
        setError(j?.message || 'Scan failed');
        return;
      }

      setItems((prev) => {
        const ix = prev.findIndex((p) => p.variant_id === variantId);
        if (ix >= 0) {
          const updated = [...prev];
          updated[ix] = { ...updated[ix], qty: updated[ix].qty + 1 };
          return updated;
        }
        return [
          ...prev,
          {
            variant_id: variantId,
            ean_code: trimmed,
            name: v?.product_name || 'Product',
            brand: v?.brand_name || '',
            size: v?.size || '',
            colour: v?.colour || v?.color || '',
            price,
            mrp: v?.mrp ?? null,
            image_url: img,
            qty: 1,
          },
        ];
      });
      showToast('Added');
    } catch {
      showToast('Network error');
    } finally {
      setSearching(false);
      setEan('');
      eanInputRef.current?.focus();
    }
  };

  const handleManualAdd = () => {
    if (!ean) return;
    scanFlow(ean);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualAdd();
    }
  };

  const addOneMore = async (row) => {
    try {
      const reserve = await fetch(`${API_BASE}/api/inventory/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch_id: branchId,
          ean_code: row.ean_code,
          qty: 1,
          sale_id: saleId,
          client_action_id: uuid(),
        }),
      });
      if (!reserve.ok) {
        const j = await reserve.json().catch(() => ({}));
        showToast(j?.message || 'Failed to add');
        return;
      }
      setItems((prev) =>
        prev.map((p) => (p.variant_id === row.variant_id ? { ...p, qty: p.qty + 1 } : p))
      );
    } catch {
      showToast('Network error');
    }
  };

  const newSale = () => {
    setItems([]);
    setSaleId(uuid());
    setPaymentRef('');
    setPaymentMethod('CASH');
    setError('');
    setPaying(false);
    setSuccessOpen(false);
    setEan('');
    eanInputRef.current?.focus();
  };

  const proceedToCheckout = () => {
    if (!items.length) return;
    setPaying(true);
  };

  const confirmPayment = async () => {
    if (!items.length) return;
    try {
      const res = await fetch(`${API_BASE}/api/sales/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sale_id: saleId,
          branch_id: branchId,
          payment: { method: paymentMethod, ref: paymentRef || null },
          items: items.map((it) => ({
            variant_id: it.variant_id,
            ean_code: it.ean_code,
            qty: it.qty,
            price: it.price,
          })),
          client_action_id: uuid(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j?.message || 'Payment failed');
        return;
      }
      setPaying(false);
      setSuccessOpen(true);
      setItems([]);
      setSaleId(uuid());
      setPaymentRef('');
    } catch {
      showToast('Network error');
    }
  };

  return (
    <div className="pos-page">
      <Navbar />
      <div className="pos-container">
        <div className="pos-header">
          <div className="pos-title">POS</div>
          <div className="pos-sub">
            <span>Branch: {branchId ?? '-'}</span>
            <span>Sale: {saleId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="scan-row">
          <input
            ref={eanInputRef}
            type="text"
            placeholder="Scan EAN or type manually"
            value={ean}
            onChange={(e) => setEan(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={onKeyDown}
          />
          <button className="btn gold" onClick={handleManualAdd} disabled={searching || !ean}>
            {searching ? 'Adding...' : 'Add'}
          </button>
        </div>

        <div className="cart">
          <div className="cart-head">
            <div>Item</div>
            <div>Details</div>
            <div className="right">Price</div>
            <div className="center">Qty</div>
            <div className="right">Total</div>
          </div>

          {items.length === 0 ? (
            <div className="cart-empty">Scan or type an EAN to add items</div>
          ) : (
            items.map((it) => (
              <div className="cart-row" key={it.variant_id}>
                <div className="thumb">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} />
                  ) : (
                    <div className="thumb-ph" />
                  )}
                </div>
                <div className="info">
                  <div className="name">{it.name}</div>
                  <div className="meta">
                    <span>{it.brand || '-'}</span>
                    <span>Size: {it.size || '-'}</span>
                    <span>Color: {it.colour || '-'}</span>
                    <span>EAN: {it.ean_code}</span>
                  </div>
                </div>
                <div className="right">₹{Number(it.price).toFixed(2)}</div>
                <div className="center qty">
                  <button className="btn small" onClick={() => addOneMore(it)}>+1</button>
                  <div className="qty-box">{it.qty}</div>
                </div>
                <div className="right">₹{(it.qty * Number(it.price)).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>

        <div className="footer-bar">
          <div className="summary">
            <div className="pill">
              {totals.qty} {totals.qty === 1 ? 'Item' : 'Items'}
            </div>
            <div className="pill total">
              Total ₹{totals.total.toFixed(2)}
            </div>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={newSale}>New Sale</button>
            <button className="btn gold" onClick={proceedToCheckout} disabled={!items.length}>Proceed to Checkout</button>
          </div>
        </div>
      </div>

      {paying && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Payment</div>
            <div className="payment-grid">
              <button
                className={`pay-chip ${paymentMethod === 'CASH' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('CASH')}
              >
                Cash
              </button>
              <button
                className={`pay-chip ${paymentMethod === 'UPI' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('UPI')}
              >
                UPI
              </button>
              <button
                className={`pay-chip ${paymentMethod === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('ONLINE')}
              >
                Online
              </button>
            </div>
            <input
              className="pay-input"
              placeholder="Reference (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setPaying(false)}>Back</button>
              <button className="btn gold" onClick={confirmPayment}>Confirm</button>
            </div>
            {error ? <div className="error-text">{error}</div> : null}
          </div>
        </div>
      )}

      {successOpen && (
        <div className="modal-overlay">
          <div className="modal success">
            <div className="modal-title">Transaction Completed</div>
            <div className="success-text">Payment successful. Ready for next customer.</div>
            <div className="modal-actions">
              <button className="btn gold" onClick={() => { setSuccessOpen(false); eanInputRef.current?.focus(); }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="pos-toast">{toast}</div>}
    </div>
  );
}
