'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareImage, formatBytes, type PreparedImage } from '@/lib/image';
import { scanQr } from '@/lib/qr';
import { runOcr, type OcrProgress } from '@/lib/ocr';
import { parseCouponFields } from '@/lib/parser';
import { checkTextLanguage, type LanguageCheckResult } from '@/lib/language-check';
import type { OcrResult, ParsedCouponFields, QrScanResult } from '@/lib/types';
import { CopyButton } from './CopyButton';
import { AlertIcon, CheckCircleIcon, SparklesIcon, UploadIcon } from './Icons';

interface BaselineRun {
  id: string;
  fileName: string;
  fileSize: number;
  at: string;
  decodeMs: number;
  qrMs: number;
  ocrMs: number;
  totalMs: number;
  qr: QrScanResult | null;
  ocrConfidence: number | null;
  ocrChars: number;
  parsed: ParsedCouponFields;
  language: LanguageCheckResult;
  /** ชื่อที่ระบบสร้าง (เก็บไว้เทียบ) */
  autoTitle: string;
  /** ชื่อที่ผู้ใช้แก้ได้ */
  title: string;
  warnings: string[];
  error?: string;
}

export function BaselineClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [current, setCurrent] = useState<BaselineRun | null>(null);
  const [runs, setRuns] = useState<BaselineRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const run = ++runRef.current;
    setProcessing(true);
    setError(null);
    setCurrent(null);
    setOcr(null);
    setProgress({ stage: 'loading-core', progress: 0, label: 'กำลังเตรียมรูป…' });

    const started = performance.now();
    const decodeStarted = performance.now();

    try {
      const prepared = await prepareImage(file);
      if (run !== runRef.current) return;
      const decodeMs = Math.round(performance.now() - decodeStarted);
      setImage(prepared);

      const qrStarted = performance.now();
      const qr = await scanQr(prepared.canvas);
      const qrMs = Math.round(performance.now() - qrStarted);

      const ocrStarted = performance.now();
      let ocrResult: OcrResult | null = null;
      let ocrError: string | null = null;
      try {
        ocrResult = await runOcr(prepared.canvas, (value) => {
          if (run === runRef.current) {
            setProgress({ ...value, progress: Math.max(10, value.progress) });
          }
        });
      } catch (cause) {
        ocrError = (cause as Error).message;
      }
      if (run !== runRef.current) return;
      const ocrMs = Math.round(performance.now() - ocrStarted);
      const totalMs = Math.round(performance.now() - started);

      const parsed = parseCouponFields({
        text: ocrResult?.text ?? '',
        qrRawValue: qr?.rawValue,
      });

      const language = checkTextLanguage(parsed.description ?? '', {
        ocrConfidence: ocrResult?.confidence ?? null,
      });
      const warnings = [...parsed.warnings];
      if (!qr) warnings.push('ไม่พบ QR/บาร์โค้ดในรูป');
      if (ocrError) warnings.push(ocrError);

      const result: BaselineRun = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name || 'clipboard-image',
        fileSize: file.size,
        at: new Date().toISOString(),
        decodeMs,
        qrMs,
        ocrMs,
        totalMs,
        qr,
        ocrConfidence: ocrResult?.confidence ?? null,
        ocrChars: ocrResult?.text.length ?? 0,
        parsed,
        language,
        autoTitle: parsed.title,
        title: parsed.title,
        warnings,
        error: ocrError ?? undefined,
      };

      setCurrent(result);
      setOcr(ocrResult);
      setRuns((list) => [result, ...list].slice(0, 30));
    } catch (cause) {
      if (run === runRef.current) setError((cause as Error).message);
    } finally {
      if (run === runRef.current) {
        setProcessing(false);
        setProgress(null);
      }
    }
  }, []);

  useEffect(() => {
    if (processing) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      if (file) {
        event.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [processing, handleFile]);

  const qrSuccess = runs.filter((item) => item.qr).length;
  const confidenceValues = runs
    .map((item) => item.ocrConfidence)
    .filter((value): value is number => typeof value === 'number');
  const avgConfidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;
  const avgTotal = runs.length
    ? Math.round(runs.reduce((sum, item) => sum + item.totalMs, 0) / runs.length)
    : null;

  function updateRunTitle(id: string, title: string) {
    setRuns((list) => list.map((run) => (run.id === id ? { ...run, title } : run)));
    setCurrent((run) => (run && run.id === id ? { ...run, title } : run));
  }

  function exportJson(): string {
    return JSON.stringify(
      runs.map(({ id, fileName, fileSize, at, decodeMs, qrMs, ocrMs, totalMs, qr, ocrConfidence, ocrChars, parsed, language, autoTitle, title, warnings, error }) => ({
        id,
        fileName,
        fileSize,
        at,
        timings: { decodeMs, qrMs, ocrMs, totalMs },
        qr,
        ocrConfidence,
        ocrChars,
        parsed,
        language,
        autoTitle,
        title,
        titleChanged: title !== autoTitle,
        warnings,
        error: error ?? null,
      })),
      null,
      2,
    );
  }

  return (
    <div className="baseline-grid">
      <div className="panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              <SparklesIcon size={17} /> ทดสอบ 1 รูป
            </h2>
            <p className="section-sub">ประมวลผลในเครื่อง ไม่บันทึก</p>
          </div>
        </div>

        <div
          className={`dropzone${dragging ? ' is-over' : ''}`}
          style={{ padding: '28px 18px' }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file && !processing) void handleFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            disabled={processing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          <span className="dropzone-icon">
            <UploadIcon size={22} />
          </span>
          <span className="dropzone-title">{processing ? 'กำลังประมวลผล…' : 'เลือกหรือลากรูปมาวาง'}</span>
          <span className="dropzone-hint">
            ใช้รูปจริง 20–30 ใบ · วางจาก clipboard ได้
          </span>
        </div>

        {error ? (
          <p className="notice notice-error" role="alert" style={{ marginTop: 12 }}>
            <AlertIcon size={16} />
            {error}
          </p>
        ) : null}

        {processing ? (
          <div className="processing" style={{ marginTop: 14 }}>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress?.progress ?? 5}%` }} />
            </div>
            <p className="processing-note">
              {progress?.label ?? 'กำลังเริ่ม…'} {progress ? `· ${progress.progress}%` : ''}
            </p>
            <p className="processing-note">ครั้งแรกโหลดภาษา ~20 MB</p>
          </div>
        ) : null}

        {image ? (
          <div className="review-preview" style={{ marginTop: 14, maxHeight: 200 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} alt="รูปที่ทดสอบ" style={{ maxHeight: 200 }} />
          </div>
        ) : null}

        {current ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div className="review-meta">
              <span>{current.fileName}</span>
              <span>{formatBytes(current.fileSize)}</span>
              <span>{current.totalMs} ms ทั้งหมด</span>
              {current.qr ? (
                <span className="confidence" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <CheckCircleIcon size={12} /> {current.qr.engine.toUpperCase()} · {current.qrMs} ms
                </span>
              ) : (
                <span className="confidence is-low">ไม่พบ QR</span>
              )}
              {typeof current.ocrConfidence === 'number' ? (
                <span className={`confidence${current.ocrConfidence < 65 ? ' is-low' : ''}`}>
                  OCR {Math.round(current.ocrConfidence)}%
                </span>
              ) : null}
            </div>

            <table className="result-table">
              <tbody>
                <tr>
                  <th>QR</th>
                  <td className="mono">{current.qr?.rawValue ?? '—'}</td>
                </tr>
                <tr>
                  <th>ชนิด QR</th>
                  <td>{current.qr?.type ?? '—'}</td>
                </tr>
                <tr>
                  <th>ชื่อ (แก้ได้)</th>
                  <td>
                    <input
                      className="baseline-input"
                      value={current.title}
                      maxLength={100}
                      aria-label="แก้ชื่อคูปอง"
                      onChange={(event) => updateRunTitle(current.id, event.target.value)}
                    />
                    {current.title !== current.autoTitle ? (
                      <div className="baseline-title-meta">
                        <span>ระบบตั้ง: {current.autoTitle}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateRunTitle(current.id, current.autoTitle)}
                        >
                          คืนค่า
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <th>ร้านค้า</th>
                  <td>{current.parsed.merchant ?? '—'}</td>
                </tr>
                <tr>
                  <th>ส่วนลด</th>
                  <td>{current.parsed.discountText ?? '—'}</td>
                </tr>
                <tr>
                  <th>รหัสคูปอง</th>
                  <td className="mono">{current.parsed.couponCode ?? '—'}</td>
                </tr>
                <tr>
                  <th>วันหมดอายุ</th>
                  <td>{current.parsed.expiryDate ?? '—'}</td>
                </tr>
                <tr>
                  <th>OCR</th>
                  <td>{current.ocrChars} ตัว</td>
                </tr>
                <tr>
                  <th>ภาษา</th>
                  <td>
                    <span className={`lang-score-inline lang-${current.language.level}`}>
                      {current.language.score}% · {current.language.label}
                    </span>
                    {current.language.tokens.length > 0 ? (
                      <span className="lang-mini-flags">
                        {current.language.tokens.slice(0, 4).map((token) => token.word).join(', ')}
                      </span>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <th>เวลา</th>
                  <td className="mono">
                    decode {current.decodeMs} · QR {current.qrMs} · OCR {current.ocrMs} ms
                  </td>
                </tr>
              </tbody>
            </table>

            {current.warnings.length > 0 ? (
              <div className="warning-list">
                {current.warnings.map((warning) => (
                  <p className="notice notice-warn" key={warning} style={{ fontSize: 12.5 }}>
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <details className="ocr-details" open={current.parsed.warnings.length > 0}>
              <summary>ข้อความ OCR ทั้งหมด</summary>
              <pre className="raw-text">{ocr?.text || '—'}</pre>
            </details>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">สรุปผล</h2>
            <p className="section-sub">สูงสุด 30 รูป</p>
          </div>
          {runs.length > 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRuns([])}>
              ล้าง
            </button>
          ) : null}
        </div>

        <div className="meta-grid" style={{ marginBottom: 16 }}>
          <div className="meta-item">
            <span className="meta-label">รูป</span>
            <span className="meta-value">{runs.length}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">QR ผ่าน</span>
            <span className="meta-value">
              {runs.length > 0 ? `${Math.round((qrSuccess / runs.length) * 100)}%` : '—'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">OCR เฉลี่ย</span>
            <span className="meta-value">{avgConfidence !== null ? `${avgConfidence}%` : '—'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">เวลาเฉลี่ย</span>
            <span className="meta-value">{avgTotal !== null ? `${avgTotal} ms` : '—'}</span>
          </div>
        </div>

        {runs.length === 0 ? (
          <p className="muted small">
            ยังไม่มีผล — เลือกรูปเพื่อเริ่มวัด
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="result-table">
                <thead>
                  <tr>
                    <th>ไฟล์</th>
                    <th>QR</th>
                    <th>OCR</th>
                    <th>เวลา</th>
                    <th>ภาษา</th>
                    <th>ชื่อ (แก้ได้)</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((item) => (
                    <tr key={item.id}>
                      <td style={{ maxWidth: 160, overflowWrap: 'anywhere' }}>{item.fileName}</td>
                      <td>{item.qr ? item.qr.engine.toUpperCase() : '—'}</td>
                      <td>{typeof item.ocrConfidence === 'number' ? `${Math.round(item.ocrConfidence)}%` : '—'}</td>
                      <td className="mono">{item.totalMs} ms</td>
                      <td>{item.language.score}%</td>
                      <td>
                        <input
                          className="baseline-input"
                          value={item.title}
                          maxLength={100}
                          aria-label={`แก้ชื่อ ${item.fileName}`}
                          onChange={(event) => updateRunTitle(item.id, event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CopyButton
                value={exportJson()}
                label="คัดลอก JSON"
                className="btn btn-secondary btn-sm"
              />
            </div>
            <p className="field-hint" style={{ marginTop: 8 }}>
              ใช้แนบเป็นหลักฐาน baseline
            </p>
          </>
        )}
      </div>
    </div>
  );
}
