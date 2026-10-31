'use client';

import { useRef, useState } from 'react';
import type { QrDisplayCoupon } from '@/lib/qr-display';
import { getQrDisplayValues } from '@/lib/qr-display';
import { BarcodeCanvas } from './BarcodeCanvas';
import { QrCanvas } from './QrCanvas';
import { CopyButton } from './CopyButton';
import { QrIcon, TicketIcon } from './Icons';

type TabKey = 'code' | 'barcode' | 'qr';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'code', label: 'เลข QR' },
  { key: 'barcode', label: 'บาร์โค้ด' },
  { key: 'qr', label: 'QR' },
];

export function QrTabs({ coupon }: { coupon: QrDisplayCoupon }) {
  const values = getQrDisplayValues(coupon);
  const initial: TabKey = coupon.qrRawValue ? 'qr' : values.value ? 'barcode' : 'code';
  const [tab, setTab] = useState<TabKey>(initial);
  const buttons = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + offset + TABS.length) % TABS.length];
    setTab(next.key);
    buttons.current[next.key]?.focus();
  }

  return (
    <div className="qr-tabs-wrap">
      <div className="qr-tabs" role="tablist" aria-label="รูปแบบการแสดงคูปอง">
        {TABS.map((entry, index) => (
          <button
            key={entry.key}
            ref={(element) => {
              buttons.current[entry.key] = element;
            }}
            type="button"
            role="tab"
            id={`qr-tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls={`qr-panel-${entry.key}`}
            tabIndex={tab === entry.key ? 0 : -1}
            className="qr-tab"
            onClick={() => setTab(entry.key)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        className="qr-panel"
        role="tabpanel"
        id="qr-panel-code"
        aria-labelledby="qr-tab-code"
        hidden={tab !== 'code'}
      >
        {values.code ? (
          <>
            <p className="qr-label">เลขคูปอง</p>
            <p className="qr-code-big">{values.code}</p>
            <CopyButton value={values.code} label="คัดลอก" className="btn btn-secondary btn-sm" />
            {values.showRaw && values.rawValue ? (
              <div className="qr-raw">
                <p className="qr-label">ข้อมูล QR</p>
                <p className="qr-raw-value">{values.rawValue}</p>
                <CopyButton value={values.rawValue} label="คัดลอก" className="btn btn-ghost btn-sm" />
              </div>
            ) : null}
          </>
        ) : (
          <div className="qr-empty">
            <QrIcon size={22} />
            <p>คูปองนี้ไม่มีเลข QR หรือรหัสคูปอง</p>
          </div>
        )}
      </div>

      <div
        className="qr-panel"
        role="tabpanel"
        id="qr-panel-barcode"
        aria-labelledby="qr-tab-barcode"
        hidden={tab !== 'barcode'}
      >
        {values.value ? (
          <>
            <p className="qr-label">บาร์โค้ด Code 128</p>
            <BarcodeCanvas value={values.value} />
            <p className="qr-code-text">{values.value}</p>
            <p className="qr-hint">สแกนที่เคาน์เตอร์</p>
          </>
        ) : (
          <div className="qr-empty">
            <TicketIcon size={22} />
            <p>{values.reason ?? 'คูปองนี้ไม่มีรหัสสำหรับสร้างบาร์โค้ด'}</p>
          </div>
        )}
      </div>

      <div
        className="qr-panel"
        role="tabpanel"
        id="qr-panel-qr"
        aria-labelledby="qr-tab-qr"
        hidden={tab !== 'qr'}
      >
        {coupon.qrRawValue ? (
          <>
            <QrCanvas value={coupon.qrRawValue} />
            <p className="qr-hint">สแกนที่เคาน์เตอร์</p>
          </>
        ) : (
          <div className="qr-empty">
            <QrIcon size={22} />
            <p>คูปองนี้ไม่มีข้อมูล QR</p>
          </div>
        )}
      </div>
    </div>
  );
}
