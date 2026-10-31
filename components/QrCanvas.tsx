'use client';

import { useEffect, useRef, useState } from 'react';

export function QrCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    import('qrcode')
      .then((module) => {
        const QRCode = module.default ?? module;
        if (cancelled || !canvasRef.current) return;
        return QRCode.toCanvas(canvasRef.current, value, {
          width: 1024,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#17150f', light: '#ffffff' },
        });
      })
      .catch(() => {
        if (!cancelled) setError('สร้าง QR Code ไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <>
      <canvas ref={canvasRef} className="qr-canvas" aria-label={`QR Code: ${value}`} />
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
