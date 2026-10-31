'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coupon, OcrResult, QrScanResult } from '@/lib/types';
import { prepareImage, type PreparedImage } from '@/lib/image';
import { scanQr } from '@/lib/qr';
import { runOcr, type OcrProgress } from '@/lib/ocr';
import { normalizeForCompare, parseCouponFields } from '@/lib/parser';
import { formatThaiDate } from '@/lib/format';
import { checkTextLanguage } from '@/lib/language-check';
import { CouponFields, emptyCouponForm, type CouponFormState } from './CouponFields';
import { ImageCropper } from './ImageCropper';
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  CheckCircleIcon,
  InfoIcon,
  QrIcon,
  SparklesIcon,
  UploadIcon,
} from './Icons';

type Phase = 'idle' | 'processing' | 'review';

interface ExistingCoupon {
  couponId: string;
  title: string;
  qrRawValue?: string;
  couponCode?: string;
}

interface Timings {
  decode?: number;
  qr?: number;
  ocr?: number;
}

interface Meta {
  warnings: string[];
  qr: QrScanResult | null;
  ocrText: string;
  confidence: number | null;
  size?: { width: number; height: number };
}

export function AddCouponFlow({ existing, userId }: { existing: ExistingCoupon[]; userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('idle');
  const [dragging, setDragging] = useState(false);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [timings, setTimings] = useState<Timings>({});
  const [meta, setMeta] = useState<Meta>({ warnings: [], qr: null, ocrText: '', confidence: null });
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<ExistingCoupon | null>(null);
  const [source, setSource] = useState<'upload' | 'paste'>('upload');
  const [cropping, setCropping] = useState(false);

  // ต้องอยู่ก่อน early return ทุกตัว ไม่งั้น hook count เปลี่ยนตอนเปลี่ยน phase → React error #310
  const language = useMemo(
    () => checkTextLanguage(form.description, { ocrConfidence: meta.confidence }),
    [form.description, meta.confidence],
  );

  // เปลี่ยนช่วง (idle → processing → review) ให้เริ่มที่ด้านบนเสมอ กันหน้าเด้งค้างตำแหน่งเดิม
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'idle') return;
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      if (file) {
        event.preventDefault();
        void handleFile(file, 'paste');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reset = useCallback(() => {
    runRef.current += 1;
    setPhase('idle');
    setImage(null);
    setProgress(null);
    setTimings({});
    setMeta({ warnings: [], qr: null, ocrText: '', confidence: null });
    setForm(emptyCouponForm);
    setErrors({});
    setOcrError(null);
    setError(null);
    setDuplicate(null);
    setCropping(false);
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }, []);

  async function handleFile(file: File, selectedVia: 'upload' | 'paste' = 'upload') {
    const run = ++runRef.current;
    setSource(selectedVia);
    setPhase('processing');
    setError(null);
    setOcrError(null);
    setDuplicate(null);
    setErrors({});
    setCropping(false);
    setProgress({ stage: 'loading-core', progress: 0, label: 'กำลังเตรียมรูป…' });
    setTimings({});

    const startedAt = performance.now();

    try {
      const prepared = await prepareImage(file);
      if (run !== runRef.current) return;

      const decodeMs = Math.round(performance.now() - startedAt);
      setImage(prepared);
      setTimings({ decode: decodeMs });
      setMeta({
        warnings: [],
        qr: null,
        ocrText: '',
        confidence: null,
        size: { width: prepared.width, height: prepared.height },
      });
      setProgress({ stage: 'recognizing', progress: 8, label: 'กำลังอ่าน QR Code…' });

      const qrResult = await scanQr(prepared.canvas);
      if (run !== runRef.current) return;
      setTimings((current) => ({ ...current, qr: qrResult?.ms ?? 0 }));
      setProgress({ stage: 'recognizing', progress: 18, label: 'กำลังอ่านข้อความในรูป…' });

      let ocrResult: OcrResult | null = null;
      let ocrFailure: string | null = null;
      try {
        ocrResult = await runOcr(prepared.canvas, (value) => {
          if (run === runRef.current) {
            setProgress({ ...value, progress: Math.max(18, Math.round(18 + value.progress * 0.8)) });
          }
        });
      } catch (cause) {
        ocrFailure = (cause as Error).message;
      }
      if (run !== runRef.current) return;

      setOcrError(ocrFailure);
      setTimings((current) => ({ ...current, ocr: Math.round(performance.now() - startedAt - decodeMs) }));

      const parsed = parseCouponFields({
        text: ocrResult?.text ?? '',
        qrRawValue: qrResult?.rawValue,
      });

      const warnings = [...parsed.warnings];
      if (!qrResult) warnings.unshift('ไม่พบ QR Code ในรูป — บันทึกได้ แต่จะไม่มี QR ให้สแกน');
      if (ocrFailure) warnings.push(`อ่านข้อความไม่สำเร็จ: ${ocrFailure}`);

      setMeta({
        warnings,
        qr: qrResult,
        ocrText: ocrResult?.text ?? '',
        confidence: ocrResult?.confidence ?? null,
        size: { width: prepared.width, height: prepared.height },
      });

      const nextForm: CouponFormState = {
        title: parsed.title,
        merchant: parsed.merchant ?? '',
        discountText: parsed.discountText ?? '',
        couponCode: parsed.couponCode ?? '',
        expiryDate: parsed.expiryDate ?? '',
        description: parsed.description ?? '',
        note: '',
        qrRawValue: qrResult?.rawValue ?? '',
      };

      setForm(nextForm);
      setDuplicate(findDuplicate(nextForm));
      setPhase('review');
      setProgress(null);
    } catch (cause) {
      if (run !== runRef.current) return;
      setError((cause as Error).message);
      setPhase('idle');
      setProgress(null);
    }
  }

  function findDuplicate(values: CouponFormState): ExistingCoupon | null {
    const qrKey = normalizeForCompare(values.qrRawValue);
    const codeKey = normalizeForCompare(values.couponCode);
    return (
      existing.find((coupon) => {
        if (qrKey && normalizeForCompare(coupon.qrRawValue) === qrKey) return true;
        if (codeKey && normalizeForCompare(coupon.couponCode) === codeKey) return true;
        return false;
      }) ?? null
    );
  }

  function updateField(field: keyof CouponFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'กรุณากรอกชื่อคูปอง';
    if (form.title.trim().length > 100) next.title = 'ชื่อคูปองต้องไม่เกิน 100 ตัวอักษร';
    if (form.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiryDate)) {
      next.expiryDate = 'วันหมดอายุไม่ถูกต้อง';
    }
    if (form.qrRawValue.length > 2000) next.qrRawValue = 'ข้อมูล QR ยาวเกิน 2,000 ตัวอักษร';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!image || saving) return;
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          ...form,
          userId,
          qrType: meta.qr?.type,
          source,
          ocrTextRaw: meta.ocrText.slice(0, 5000),
          ocrConfidence: meta.confidence ?? undefined,
          imageBase64: image.base64,
          imageMimeType: image.mimeType,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        data?: { coupon: Coupon };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        if (payload.error?.fields) setErrors(payload.error.fields);
        throw new Error(payload.error?.message ?? 'บันทึกคูปองไม่สำเร็จ');
      }

      router.push(`/user/${userId}/coupons/${payload.data.coupon.couponId}?created=1`);
    } catch (cause) {
      setError((cause as Error).message);
      setSaving(false);
    }
  }

  if (phase === 'idle') {
    return (
      <div className="uploader">
        {error ? (
          <p className="notice notice-error" role="alert">
            <AlertIcon size={16} />
            {error}
          </p>
        ) : null}

        <label
          className={`dropzone${dragging ? ' is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <span className="dropzone-icon">
            <UploadIcon size={24} />
          </span>
          <span className="dropzone-title">อัปโหลดหรือถ่ายรูปคูปอง</span>
          <span className="dropzone-hint">
            เลือกจากเครื่อง ลากมาวาง หรือถ่ายรูปใหม่ — JPG, PNG, WEBP, HEIC (ไม่เกิน 10 MB)
          </span>
          <span className="dropzone-kbd">
            หรือกด <kbd>⌘</kbd> + <kbd>V</kbd> เพื่อวางรูปจาก clipboard
          </span>
        </label>

        <div className="notice notice-info">
          <InfoIcon size={16} />
          <span>
            ระบบอ่าน QR และข้อความในเบราว์เซอร์ของคุณ รูปจะถูกส่งเข้าระบบก็ต่อเมื่อกด “บันทึกคูปอง” เท่านั้น
          </span>
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />

        <div className="form-actions">
          <Link href="/" className="btn btn-ghost">
            ยกเลิก
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
            <UploadIcon size={16} />
            อัปโหลดรูป
          </button>
          <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
            <CameraIcon size={16} />
            ถ่ายรูป
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'processing') {
    const qrDone = timings.qr !== undefined;
    const ocrActive = progress?.stage === 'recognizing' || progress?.stage === 'done';
    const ocrDone = meta.ocrText.length > 0 || Boolean(ocrError);

    return (
      <div className="processing panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              <SparklesIcon size={18} /> กำลังอ่านคูปอง…
            </h2>
            <p className="section-sub">ครั้งแรกอาจใช้เวลาสักครู่เพื่อโหลดข้อมูลภาษาไทย</p>
          </div>
          <span className="confidence">{progress?.progress ?? 0}%</span>
        </div>

        {image ? (
          <div className="review-preview" style={{ maxHeight: 240 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} alt="ตัวอย่างรูปที่อัปโหลด" style={{ maxHeight: 240 }} />
          </div>
        ) : null}

        <div className="progress" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${progress?.progress ?? 4}%` }} />
        </div>

        <div className="steps">
          <div className={`step${image ? ' is-done' : ' is-active'}`}>
            <span className="step-dot">{image ? <CheckIcon size={12} /> : '1'}</span>
            เตรียมรูปและย่อขนาด
            {timings.decode !== undefined ? <span className="muted small">· {timings.decode} ms</span> : null}
          </div>
          <div className={`step${qrDone ? ' is-done' : image ? ' is-active' : ''}`}>
            <span className="step-dot">{qrDone ? <CheckIcon size={12} /> : '2'}</span>
            อ่าน QR Code {meta.qr ? `· ${meta.qr.engine.toUpperCase()}` : ''}
          </div>
          <div className={`step${ocrDone ? ' is-done' : ocrActive ? ' is-active' : ''}`}>
            <span className="step-dot">{ocrDone ? <CheckIcon size={12} /> : '3'}</span>
            อ่านข้อความด้วย OCR (ไทย + อังกฤษ)
          </div>
        </div>

        <p className="processing-note">
          {progress?.label ?? 'กำลังเริ่มต้น…'} {progress && progress.progress > 0 ? `· ${progress.progress}%` : ''}
        </p>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={reset}>
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  const confidence = meta.confidence;
  const lowConfidence = confidence !== null && confidence < 65;

  return (
    <form onSubmit={save}>
      <div className="review-grid">
        <aside className="review-media">
          {image ? (
            <div className="review-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt="Screenshot คูปองที่อัปโหลด" />
            </div>
          ) : null}

          {image ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-block"
              onClick={() => setCropping(true)}
              disabled={saving}
              style={{ marginTop: 8 }}
            >
              ครอปรูป
            </button>
          ) : null}

          <div className="review-meta">
            {meta.size ? <span>{meta.size.width} × {meta.size.height} px</span> : null}
            {timings.qr !== undefined ? <span>QR {timings.qr} ms</span> : null}
            {confidence !== null ? (
              <span className={`confidence${lowConfidence ? ' is-low' : ''}`}>
                OCR {Math.round(confidence)}%
                {lowConfidence ? ' · ควรตรวจสอบ' : ''}
              </span>
            ) : null}
            {meta.qr ? (
              <span className="confidence" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <QrIcon size={12} />
                {meta.qr.engine.toUpperCase()}
              </span>
            ) : null}
          </div>

          {form.description.trim() ? (
            <div className={`lang-box lang-${language.level}`}>
              <div className="lang-head">
                <span className="lang-score">ภาษา {language.score}%</span>
                <span className="lang-label">{language.label}</span>
              </div>
              {language.tokens.length > 0 ? (
                <ul className="lang-list">
                  {language.tokens.slice(0, 5).map((token) => (
                    <li key={token.word}>
                      <strong>{token.word}</strong>
                      <span>{token.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lang-ok">ไม่พบคำน่าสงสัย</p>
              )}
              {language.notes.includes('OCR confidence ต่ำ') ? (
                <p className="lang-note">OCR confidence ต่ำ — ควรตรวจข้อความ</p>
              ) : null}
            </div>
          ) : null}

          {meta.qr ? (
            <div className="ocr-details">
              <summary style={{ listStyle: 'none', cursor: 'default' }}>ข้อมูล QR ที่อ่านได้</summary>
              <p className="mono small" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
                {meta.qr.rawValue}
              </p>
            </div>
          ) : null}

          {meta.warnings.length > 0 ? (
            <div className="warning-list">
              {meta.warnings.map((warning) => (
                <p className="notice notice-warn" key={warning}>
                  <AlertIcon size={16} />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <details className="ocr-details">
            <summary>ข้อความทั้งหมดที่ OCR อ่านได้</summary>
            <pre className="raw-text">{meta.ocrText || 'ไม่พบข้อความ'}</pre>
          </details>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              เลือกรูปใหม่
            </button>
            {form.expiryDate ? (
              <span className="small muted" style={{ alignSelf: 'center' }}>
                หมดอายุ {formatThaiDate(form.expiryDate)}
              </span>
            ) : null}
          </div>
        </aside>

        <div className="panel">
          <div className="section-head">
            <div>
              <h2 className="section-title">ตรวจสอบข้อมูลก่อนบันทึก</h2>
              <p className="section-sub">ระบบเติมข้อมูลจาก OCR ให้แล้ว — แก้ไขได้ทุกช่อง</p>
            </div>
          </div>

          {duplicate ? (
            <div className="notice notice-warn" style={{ marginBottom: 16 }}>
              <AlertIcon size={16} />
              <span>
                พบคูปองที่อาจซ้ำ: <strong>{duplicate.title}</strong> ({duplicate.couponId}){' '}
                <Link href={`/user/${userId}/coupons/${duplicate.couponId}`} style={{ textDecoration: 'underline' }}>
                  ดูคูปองเดิม
                </Link>
                <br />
                หากยังต้องการบันทึก ให้กด “บันทึกคูปอง” ตามปกติ ระบบจะบันทึกเป็นใบใหม่
              </span>
            </div>
          ) : null}

          {ocrError ? (
            <div className="notice notice-warn" style={{ marginBottom: 16 }}>
              <AlertIcon size={16} />
              <span>
                {ocrError}
                <br />
                กรุณากรอกข้อมูลเองหรือลองอัปโหลดรูปที่ชัดขึ้น
              </span>
            </div>
          ) : null}

          {error ? (
            <p className="notice notice-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertIcon size={16} />
              {error}
            </p>
          ) : null}

          <CouponFields values={form} errors={errors} disabled={saving} onChange={updateField} />

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={reset} disabled={saving}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : (
                <>
                  <CheckCircleIcon size={16} />
                  บันทึกคูปอง
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {cropping && image ? (
        <ImageCropper
          image={image}
          onCancel={() => setCropping(false)}
          onApply={(next) => {
            setImage(next);
            setMeta((current) => ({
              ...current,
              size: { width: next.width, height: next.height },
            }));
            setCropping(false);
          }}
        />
      ) : null}
    </form>
  );
}
