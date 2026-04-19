// BarcodeScanner.js
import React, { useEffect, useRef, useState } from 'react';

/**
 * Lightweight wrapper that tries camera scanning via @zxing/browser
 * but gracefully falls back to manual input if not available.
 *
 * Props:
 *  - onDetected(value: string)
 */
export default function BarcodeScanner({ onDetected }) {
  const videoRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let codeReader = null;
    let cancelled = false;

    async function start() {
      try {
        // dynamic import (won't break build if library missing)
        const mod = await import('@zxing/browser').catch(() => null);
        if (!mod) return;

        const { BrowserMultiFormatReader } = mod;
        codeReader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices || !devices.length) return;

        setSupported(true);
        await codeReader.decodeFromVideoDevice(
          devices[0].deviceId,
          videoRef.current,
          (res, err) => {
            if (cancelled) return;
            if (res?.text) {
              onDetected?.(res.text.trim());
            } else if (err) {
              // ignore frequent decode errors
            }
          }
        );
      } catch (e) {
        setError('Camera scan unavailable');
      }
    }
    start();

    return () => {
      cancelled = true;
      try { codeReader?.reset(); } catch {}
    };
  }, [onDetected]);

  return (
    <div className="scanner-wrap" style={{ display: 'grid', gap: 8 }}>
      {supported ? (
        <video ref={videoRef} style={{ width: '100%', maxWidth: 420, borderRadius: 8 }} muted playsInline />
      ) : (
        <>
          <input
            placeholder="Enter/scan barcode"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manual.trim()) {
                onDetected?.(manual.trim());
                setManual('');
              }
            }}
          />
          {error ? <small style={{ color: '#f66' }}>{error}</small> : (
            <small>Camera scanning not available. Type or use a USB barcode scanner here.</small>
          )}
        </>
      )}
    </div>
  );
}
