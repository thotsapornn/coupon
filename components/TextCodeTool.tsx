'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { shareBaseUrl } from '@/lib/site-url';
import { getBarcodeForText } from '@/lib/qr-display';
import { BarcodeCanvas } from './BarcodeCanvas';
import { CopyButton } from './CopyButton';
import { QrCanvas } from './QrCanvas';
import { CopyIcon, ShareIcon, SparklesIcon, TicketIcon } from './Icons';

type TabKey = 'code' | 'barcode' | 'qr';

// เรียงตามความสำคัญ: QR คือผลลัพธ์หลัก รองลงมาบาร์โค้ด แล้วข้อความ
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'qr', label: 'QR' },
  { key: 'barcode', label: 'บาร์โค้ด' },
  { key: 'code', label: 'ข้อความ' },
];

export function TextCodeTool({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [showInput, setShowInput] = useState(() => !initialText.trim());
  const [tab, setTab] = useState<TabKey>('qr');
  const [status, setStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const value = text.trim();
  const barcode = useMemo(() => getBarcodeForText(value, 80), [value]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  // อัปเดตเมื่อเปิดลิงก์ใหม่
  useEffect(() => {
    setText(initialText);
    setShowInput(!initialText.trim());
  }, [initialText]);

  // เก็บข้อความใน URL เพื่อ refresh/share โดยไม่บันทึกลงที่ใด
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!value) {
      if (window.location.pathname === '/qr' && window.location.search) {
        window.history.replaceState(null, '', '/qr');
      }
      return;
    }
    const target = `/qr?text=${encodeURIComponent(value)}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== target) window.history.replaceState(null, '', target);
  }, [value]);

  function shareUrl(): string {
    return `${shareBaseUrl()}/qr?text=${encodeURIComponent(value)}`;
  }

  async function copyLink() {
    if (!value) return;
    await copyText(shareUrl());
    setStatus('คัดลอกลิงก์แล้ว');
  }

  async function share() {
    if (!value) return;
    const url = shareUrl();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'QR / บาร์โค้ด', text: value, url });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  function startNew() {
    setText('');
    setTab('qr');
    setStatus(null);
    setShowInput(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/qr');
    }
    window.setTimeout(() => textareaRef.current?.focus(), 60);
  }

  return (
    <div className="create-tool">
      {showInput ? (
        <div className="create-card">
          <label className="visually-hidden" htmlFor="create-text">
            ข้อความที่ต้องการสร้าง QR หรือบาร์โค้ด
          </label>
          <textarea
            id="create-text"
            ref={textareaRef}
            className="create-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="พิมพ์ข้อความ เช่น SAVE50 หรือ https://…"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="create-meta">
            <span className="create-count">{text.length}/500</span>
            {value ? <CopyButton value={value} label="คัดลอกข้อความ" /> : null}
          </div>

          <p className="create-note">ไม่บันทึกข้อมูล · ข้อความอยู่ในลิงก์</p>
        </div>
      ) : null}

      {value ? (
        <>
          <div className="create-card">
            <div className="qr-tabs" role="tablist" aria-label="รูปแบบที่ต้องการสร้าง">
              {TABS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  id={`create-tab-${entry.key}`}
                  aria-selected={tab === entry.key}
                  aria-controls={`create-panel-${entry.key}`}
                  className="qr-tab"
                  onClick={() => setTab(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div
              className="qr-panel"
              role="tabpanel"
              id="create-panel-code"
              aria-labelledby="create-tab-code"
              hidden={tab !== 'code'}
            >
              <p className="qr-label">ข้อความ</p>
              <p className="create-readonly">{value}</p>
              <CopyButton value={value} label="คัดลอกข้อความ" />
            </div>

            <div
              className="qr-panel"
              role="tabpanel"
              id="create-panel-barcode"
              aria-labelledby="create-tab-barcode"
              hidden={tab !== 'barcode'}
            >
              {barcode.value ? (
                <>
                  <p className="qr-label">บาร์โค้ด Code 128</p>
                  <BarcodeCanvas value={barcode.value} />
                  <p className="qr-code-text">{barcode.value}</p>
                </>
              ) : (
                <div className="qr-empty">
                  <TicketIcon size={22} />
                  <p>{barcode.reason ?? 'สร้างบาร์โค้ดไม่ได้'}</p>
                  <p className="small muted">ใช้แท็บ QR แทนได้</p>
                </div>
              )}
            </div>

            <div
              className="qr-panel"
              role="tabpanel"
              id="create-panel-qr"
              aria-labelledby="create-tab-qr"
              hidden={tab !== 'qr'}
            >
              <QrCanvas value={value} />
              <p className="qr-hint">สแกนด้วยกล้องมือถือ</p>
            </div>
          </div>

          <div className="create-share">
            <button type="button" className="btn btn-secondary" onClick={copyLink}>
              <CopyIcon size={15} />
              คัดลอกลิงก์
            </button>
            <button type="button" className="btn btn-secondary" onClick={share}>
              <ShareIcon size={15} />
              แชร์
            </button>
            {!showInput ? (
              <button type="button" className="btn btn-primary" onClick={startNew}>
                <SparklesIcon size={15} />
                สร้างใหม่
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {status ? (
        <p className="notice notice-success" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
