'use client';

import { useEffect, useRef, useState } from 'react';

export function BarcodeCanvas({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    import('jsbarcode')
      .then((module) => {
        const JsBarcode = module.default ?? module;
        if (cancelled || !svgRef.current) return;
        svgRef.current.replaceChildren();
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 8,
          background: '#ffffff',
          lineColor: '#17150f',
        });
      })
      .catch(() => {
        if (!cancelled) setError('สร้างบาร์โค้ดไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <>
      <svg ref={svgRef} className="barcode-svg" role="img" aria-label={`บาร์โค้ด ${value}`} />
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
