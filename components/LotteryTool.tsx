'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { prepareImage, type PreparedImage } from '@/lib/image';
import { encodeShareJson } from '@/lib/share-codec';
import {
  buildLotterySummary,
  DEFAULT_LOTTERY_PRICE,
  encodeLotteryShare,
  formatEntryPrice,
  formatMoney,
  isValidDiscount,
  isValidLotteryEntry,
  MAX_SHARE_CHARS,
  matchesRestricted,
  normalizeDigits,
  normalizeLotteryNumber,
  normalizePrice,
  parseRestrictedNumbers,
  summaryToText,
  uniquePermutations,
  type LotteryEntry,
  type SharedLotteryState,
} from '@/lib/lottery';
import { runOcr, type OcrProgress } from '@/lib/ocr';
import { cleanOcrText } from '@/lib/parser';
import {
  defaultLotteryDrawDate,
  lotteryRoundDateLabel,
  lotteryRoundKeyForDate,
} from '@/lib/lottery-history';
import { CopyButton } from './CopyButton';
import { LotteryHistoryStats } from './LotteryHistoryStats';
import { LotteryShareMenu } from './LotteryShareMenu';
import { useLotteryShare, type ShareMethod, type ShareMode } from './LotteryShareContext';
import {
  AlertIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TicketIcon,
  TrashIcon,
  XIcon,
} from './Icons';

type OcrPhase = 'idle' | 'preparing' | 'recognizing' | 'done' | 'error';

const STORAGE_KEY = 'coupon.lottery.draft.v3';

function sanitizePriceInput(value: string): string {
  const raw = normalizeDigits(value).replace(/[^\d.]/g, '');
  const [whole, ...rest] = raw.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

export function LotteryTool({ initialData }: { initialData?: SharedLotteryState | null }) {
  const { registerShare } = useLotteryShare();
  const [restrictedText, setRestrictedText] = useState('');

  const [entries, setEntries] = useState<LotteryEntry[]>([]);
  const [numberInput, setNumberInput] = useState('');
  const [priceInput, setPriceInput] = useState(DEFAULT_LOTTERY_PRICE);
  const [reverseInput, setReverseInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [historyRound, setHistoryRound] = useState(defaultLotteryDrawDate);

  const [ocrImage, setOcrImage] = useState<PreparedImage | null>(null);
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>('idle');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ocrRunRef = useRef(0);
  const restrictedTextRef = useRef(restrictedText);

  useEffect(() => {
    restrictedTextRef.current = restrictedText;
  }, [restrictedText]);

  useEffect(() => {
    if (!shareStatus) return;
    const timer = window.setTimeout(() => setShareStatus(null), 2600);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  // ลิงก์แชร์มาก่อน — ใช้ข้อมูลจาก URL; ถ้าไม่มีค่อยโหลดฉบับร่างในเครื่อง
  useEffect(() => {
    if (
      initialData &&
      (initialData.entries.length > 0 ||
        initialData.restrictedText.trim() ||
        initialData.numberInput ||
        initialData.historyRound ||
        initialData.editingId)
    ) {
      setRestrictedText(initialData.restrictedText);
      setPriceInput(initialData.priceInput);
      setDiscount(initialData.discount);
      setEntries(initialData.entries);
      setNumberInput(initialData.numberInput ?? '');
      setReverseInput(initialData.reverseInput ?? false);
      if (initialData.historyRound) setHistoryRound(initialData.historyRound);
      setEditingId(initialData.editingId ?? null);
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          restrictedText?: unknown;
          entries?: unknown;
          priceInput?: unknown;
          discount?: unknown;
          numberInput?: unknown;
          reverseInput?: unknown;
          historyRound?: unknown;
        };
        if (typeof data.restrictedText === 'string') setRestrictedText(data.restrictedText);
        if (Array.isArray(data.entries)) setEntries(data.entries.filter(isValidLotteryEntry));
        if (typeof data.numberInput === 'string' && /^\d{0,3}$/.test(data.numberInput)) {
          setNumberInput(data.numberInput);
        }
        if (typeof data.reverseInput === 'boolean') setReverseInput(data.reverseInput);
        if (
          typeof data.historyRound === 'string' &&
          /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(data.historyRound)
        ) {
          setHistoryRound(data.historyRound);
        }
        if (typeof data.priceInput === 'string') {
          const price = normalizePrice(data.priceInput);
          setPriceInput(price === null ? DEFAULT_LOTTERY_PRICE : String(price));
        }
        if (isValidDiscount(data.discount)) setDiscount(data.discount);
      }
    } catch {
      /* ข้อมูลในเครื่องเสีย — เริ่มใหม่ */
    }
    setHydrated(true);
  }, [initialData]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          restrictedText,
          useRestricted: true,
          includeReversed: true,
          entries,
          priceInput,
          discount,
          numberInput,
          reverseInput,
          historyRound,
        }),
      );
    } catch {
      /* เบราว์เซอร์ปิด storage — ใช้งานต่อได้ */
    }
  }, [hydrated, restrictedText, entries, priceInput, discount, numberInput, reverseInput, historyRound]);

  const restricted = useMemo(() => parseRestrictedNumbers(restrictedText), [restrictedText]);
  const restrictedTotal = restricted.three.numbers.length + restricted.two.numbers.length;

  const previewNumber = normalizeLotteryNumber(numberInput);
  const previewMatch = previewNumber
    ? matchesRestricted(previewNumber, restricted, true)
    : null;

  const summary = useMemo(
    () =>
      buildLotterySummary(entries, restricted, {
        useRestricted: true,
        includeReversed: true,
        discount,
      }),
    [entries, restricted, discount],
  );
  const summaryText = useMemo(() => summaryToText(summary.lines), [summary.lines]);
  const shareState = useMemo<SharedLotteryState>(
    () => ({
      restrictedText,
      useRestricted: true,
      includeReversed: true,
      priceInput,
      discount,
      entries,
      numberInput,
      reverseInput,
      historyRound,
      ...(editingId ? { editingId } : {}),
    }),
    [restrictedText, priceInput, discount, entries, numberInput, reverseInput, historyRound, editingId],
  );
  const sharePayload = useMemo(() => encodeLotteryShare(shareState), [shareState]);
  const fullShareData = useMemo(() => encodeURIComponent(sharePayload), [sharePayload]);
  const fullShareTooLong = sharePayload.length > MAX_SHARE_CHARS;
  const summaryShareDate = useMemo(
    () => lotteryRoundDateLabel(historyRound),
    [historyRound],
  );
  const summarySharePayload = useMemo(
    () =>
      encodeShareJson({
        date: summaryShareDate,
        text: summaryText,
        total: formatMoney(summary.discountedAmount),
        ...(discount > 0
          ? { before: formatMoney(summary.totalAmount), discount }
          : {}),
      }),
    [summaryShareDate, summaryText, summary.discountedAmount, summary.totalAmount, discount],
  );
  const summaryShareData = useMemo(
    () => encodeURIComponent(summarySharePayload),
    [summarySharePayload],
  );
  const summaryShareTooLong = summarySharePayload.length > MAX_SHARE_CHARS;
  const historyRoundKey = useMemo(
    () => lotteryRoundKeyForDate(historyRound),
    [historyRound],
  );

  // เก็บ key ที่สร้างแล้วต่อ payload — กดแชร์ซ้ำไม่สร้างไฟล์ใหม่ใน Drive
  const shareKeyCacheRef = useRef(new Map<string, string>());
  const sharingRef = useRef(false);

  const share = useCallback(async (mode: ShareMode, method: ShareMethod) => {
    if (sharingRef.current) return;

    const tooLong = mode === 'full' ? fullShareTooLong : summaryShareTooLong;
    if (tooLong) {
      setShareStatus('ลิงก์ยาวเกินไป — ลดจำนวนเลขก่อนแชร์');
      return;
    }

    const payload = mode === 'full' ? sharePayload : summarySharePayload;
    const cacheKey = `${mode}:${payload}`;
    const longUrl =
      mode === 'full'
        ? `${window.location.origin}/lottery?data=${fullShareData}`
        : `${window.location.origin}/lottery/summary?data=${summaryShareData}`;

    sharingRef.current = true;
    setShareStatus('กำลังสร้างลิงก์แชร์…');

    let url = longUrl;
    let short = false;

    try {
      let key = shareKeyCacheRef.current.get(cacheKey);
      if (!key) {
        const response = await fetch('/api/lottery/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: mode, data: payload }),
        });
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { key?: string };
        } | null;
        if (!response.ok || !body?.ok || !body.data?.key) throw new Error('share failed');
        key = body.data.key;
        if (shareKeyCacheRef.current.size > 20) shareKeyCacheRef.current.clear();
        shareKeyCacheRef.current.set(cacheKey, key);
      }

      url =
        mode === 'full'
          ? `${window.location.origin}/lottery?s=${key}`
          : `${window.location.origin}/lottery/summary?s=${key}`;
      short = true;
    } catch {
      const longUrlFits = (mode === 'full' ? fullShareData : summaryShareData).length <= 7800;
      if (!longUrlFits) {
        setShareStatus('สร้างลิงก์สั้นไม่สำเร็จ — ลองใหม่');
        return;
      }
      setShareStatus('สร้างลิงก์สั้นไม่สำเร็จ — ใช้ลิงก์แบบยาวแทน');
    } finally {
      sharingRef.current = false;
    }

    const copiedMessage =
      mode === 'full' ? 'คัดลอกลิงก์ทั้งหน้าแล้ว' : 'คัดลอกลิงก์สรุปแล้ว';
    const openedMessage =
      mode === 'full' ? 'เปิด LINE เพื่อแชร์ทั้งหน้าแล้ว' : 'เปิด LINE เพื่อแชร์สรุปแล้ว';

    if (method === 'copy') {
      await copyText(url);
      setShareStatus(short ? copiedMessage : `${copiedMessage} (แบบยาว)`);
      return;
    }

    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(url)}`;
    const popup = window.open(lineUrl, '_blank');
    if (popup) {
      popup.opener = null;
      setShareStatus(short ? openedMessage : `${openedMessage} (แบบยาว)`);
      return;
    }

    await copyText(url);
    setShareStatus(
      short ? 'คัดลอกลิงก์แล้ว — เปิด LINE แล้ววางเพื่อแชร์' : 'คัดลอกลิงก์แบบยาวแล้ว — เปิด LINE แล้ววางเพื่อแชร์',
    );
  }, [
    fullShareTooLong,
    summaryShareTooLong,
    sharePayload,
    summarySharePayload,
    fullShareData,
    summaryShareData,
  ]);

  useEffect(() => {
    const hasShareableData =
      entries.length > 0 ||
      Boolean(normalizeLotteryNumber(numberInput)) ||
      restrictedTotal > 0 ||
      Boolean(restrictedText.trim());

    registerShare(hasShareableData ? share : null, {
      full: !hasShareableData || fullShareTooLong,
      summary: summary.lines.length === 0 || summaryShareTooLong,
    });
    return () => registerShare(null);
  }, [
    registerShare,
    share,
    entries.length,
    numberInput,
    restrictedTotal,
    restrictedText,
    fullShareTooLong,
    summaryShareTooLong,
    summary.lines.length,
  ]);

  async function recognize(prepared: PreparedImage) {
    const run = ++ocrRunRef.current;
    setOcrPhase('recognizing');
    setOcrError(null);
    setOcrNotice(null);
    setOcrProgress({ stage: 'recognizing', progress: 0, label: 'กำลังอ่านเลขอั้น…' });

    try {
      const result = await runOcr(prepared.canvas, (progress) => {
        if (run === ocrRunRef.current) setOcrProgress(progress);
      });
      if (run !== ocrRunRef.current) return;

      setOcrConfidence(result.confidence);
      setOcrPhase('done');

      const text = cleanOcrText(result.text);
      if (!text) {
        setOcrPhase('error');
        setOcrError('ไม่พบข้อความในรูป — ลองรูปที่ชัดขึ้น');
        return;
      }

      if (
        restrictedTextRef.current.trim() &&
        !window.confirm('แทนที่เลขอั้นเดิมด้วยข้อความจากรูปนี้?')
      ) {
        setOcrNotice('อ่านเสร็จแล้ว แต่ไม่ได้แทนที่เลขอั้นเดิม');
        return;
      }

      setRestrictedText(text);
      setOcrNotice('อ่านข้อความจากรูปเสร็จแล้ว');
    } catch (cause) {
      if (run !== ocrRunRef.current) return;
      setOcrPhase('error');
      setOcrError((cause as Error).message);
    } finally {
      if (run === ocrRunRef.current) setOcrProgress(null);
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setOcrPhase('error');
      setOcrError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP หรือ HEIC');
      return;
    }

    const run = ++ocrRunRef.current;
    setOcrPhase('preparing');
    setOcrError(null);
    setOcrNotice(null);
    setOcrConfidence(null);
    setOcrProgress({ stage: 'loading-core', progress: 0, label: 'กำลังเตรียมรูป…' });

    try {
      const prepared = await prepareImage(file);
      if (run !== ocrRunRef.current) return;
      setOcrImage(prepared);
      await recognize(prepared);
    } catch (cause) {
      if (run !== ocrRunRef.current) return;
      setOcrPhase('error');
      setOcrError((cause as Error).message);
      setOcrProgress(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const number = normalizeLotteryNumber(numberInput);
    if (!number) {
      setFormError('กรอกเลข 2 หรือ 3 หลัก');
      return;
    }

    const price = normalizePrice(priceInput);
    if (price === null) {
      setFormError('ราคาต้องเป็นตัวเลขมากกว่า 0');
      return;
    }

    if (editingId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === editingId
            ? { ...entry, number, price, reverse: reverseInput }
            : entry,
        ),
      );
      setEditingId(null);
    } else {
      setEntries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          number,
          price,
          reverse: reverseInput,
        },
      ]);
    }

    setNumberInput('');
    setPriceInput(String(price));
    setFormError(null);
    window.setTimeout(() => numberInputRef.current?.focus(), 40);
  }

  function startEdit(entry: LotteryEntry) {
    setEditingId(entry.id);
    setNumberInput(entry.number);
    setPriceInput(String(entry.price));
    setReverseInput(entry.reverse);
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => numberInputRef.current?.focus(), 60);
  }

  function cancelEdit() {
    setEditingId(null);
    setNumberInput('');
    setFormError(null);
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (editingId === id) cancelEdit();
  }

  function clearEntries() {
    if (entries.length === 0) return;
    if (!window.confirm('ล้างเลขทั้งหมดในโพย?')) return;
    setEntries([]);
    cancelEdit();
  }

  return (
    <div className="lottery-tool">
      <div className="page-head">
        <h1 className="page-title">จัดโพยหวย</h1>
        <label className="lottery-draw-date">
          <span>งวดวันที่</span>
          <input
            type="date"
            value={historyRound}
            onChange={(event) => setHistoryRound(event.target.value)}
            aria-label="เลือกวันที่งวด"
          />
        </label>
        <p className="page-sub">
          กรอกเลขพร้อมราคา · ตรวจเลขอั้นอัตโนมัติ
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. เลขอั้น                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="lottery-card" aria-labelledby="lottery-restricted-title">
        <div className="lottery-section-head">
          <div>
            <h2 className="section-title" id="lottery-restricted-title">
              เลขอั้นจากรูป <span className="lottery-optional">ไม่บังคับ</span>
            </h2>
            <p className="section-sub">ใช้ตรวจว่าเลขที่ซื้อเป็นเลขอั้นหรือไม่</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm lottery-upload-button"
            onClick={() => fileInputRef.current?.click()}
          >
            อัปโหลด
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />

        {ocrImage ? (
          <div className="lottery-image-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ocrImage.dataUrl}
              alt="รูปเลขอั้นที่อัปโหลด"
              className="lottery-image-thumb"
            />
            <div className="lottery-image-meta">
              <span className="lottery-image-title">รูปเลขอั้น</span>
            </div>
          </div>
        ) : null}

        {ocrPhase === 'preparing' || ocrPhase === 'recognizing' ? (
          <div className="lottery-ocr-progress">
            <div className="progress" aria-hidden="true">
              <div
                className="progress-bar"
                style={{ width: `${ocrProgress?.progress ?? 4}%` }}
              />
            </div>
            <p className="processing-note">
              {ocrProgress?.label ?? 'กำลังอ่านรูป…'}
              {ocrProgress && ocrProgress.progress > 0 ? ` · ${ocrProgress.progress}%` : ''}
            </p>
          </div>
        ) : null}

        {ocrNotice ? (
          <p className="notice notice-success" role="status">
            <CheckIcon size={16} />
            <span>
              {ocrNotice}
              {ocrConfidence !== null ? ` · ความมั่นใจ ${Math.round(ocrConfidence)}%` : ''}
            </span>
          </p>
        ) : null}

        {ocrError ? (
          <p className="notice notice-warn" role="alert">
            <AlertIcon size={16} />
            <span>{ocrError}</span>
          </p>
        ) : null}

        {restrictedTotal > 0 ? (
          <div className="lottery-parsed">
            <div className="lottery-parsed-head">
              <span className="lottery-parsed-title">{restricted.title ?? 'อ่านได้'}</span>
              <span className="lottery-parsed-meta">
                {restricted.closingTime ? (
                  <span className="lottery-time">ปิดรับ {restricted.closingTime} น.</span>
                ) : null}
                {restricted.halfPay ? (
                  <span className="lottery-tag is-warn">จ่ายครึ่ง</span>
                ) : null}
              </span>
            </div>

            {restricted.three.numbers.length > 0 ? (
              <div className="lottery-group">
                <div className="lottery-group-head">
                  <span>3 ตัว</span>
                  <span className="lottery-count">{restricted.three.numbers.length} เลข</span>
                  {restricted.three.reversed ? <span className="lottery-tag">กลับ</span> : null}
                </div>
                <div className="lottery-chips">
                  {restricted.three.numbers.map((number) => (
                    <span className="lottery-chip" key={`three-${number}`}>
                      {number}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {restricted.two.numbers.length > 0 ? (
              <div className="lottery-group">
                <div className="lottery-group-head">
                  <span>2 ตัว</span>
                  <span className="lottery-count">{restricted.two.numbers.length} เลข</span>
                  {restricted.two.reversed ? <span className="lottery-tag">กลับ</span> : null}
                </div>
                <div className="lottery-chips">
                  {restricted.two.numbers.map((number) => (
                    <span className="lottery-chip" key={`two-${number}`}>
                      {number}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : restrictedText.trim() ? (
          <p className="notice notice-warn">
            <AlertIcon size={16} />
            <span>ยังอ่านเลขไม่ได้ — ลองรูปที่ชัดขึ้น</span>
          </p>
        ) : null}

        {restrictedTotal > 0 && restricted.warnings.length > 0 ? (
          <div className="warning-list">
            {restricted.warnings.map((warning) => (
              <p className="notice notice-warn" key={warning}>
                <AlertIcon size={16} />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        ) : null}

        {restrictedTotal > 0 || restrictedText.trim() ? (
          <>
            <p className="lottery-note">
              ตรวจเลขในรูปและเลขกลับให้อัตโนมัติ — ถ้าตรงกันจะแจ้งว่า “จ่ายครึ่งเดียว”
            </p>
          </>
        ) : (
          <p className="lottery-note">ไม่บังคับ — ข้ามได้ถ้าไม่ต้องการตรวจเลขอั้น</p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. เพิ่มเลข                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="lottery-card" aria-labelledby="lottery-add-title">
        <div className="lottery-section-head">
          <div>
            <h2 className="section-title" id="lottery-add-title">
              เพิ่มเลข
            </h2>
            <p className="section-sub">เพิ่มได้ทั้ง 3 ตัวและ 2 ตัว · เลือกกลับได้</p>
          </div>
          {entries.length > 0 ? (
            <span className="lottery-count">{entries.length} รายการ</span>
          ) : null}
        </div>

        <p className="lottery-form-hint">
          กรอกเลขแล้วกด + · ราคา 30 คือบน 30 + ล่าง 30
          {' · สรุปเป็น '}<span className="mono">30x30</span>
        </p>

        <form className="lottery-table-form" ref={formRef} onSubmit={submit}>
          <div className="lottery-table-wrap">
            <table className="lottery-table">
              <thead>
                <tr>
                  <th scope="col">เลข</th>
                  <th scope="col">ราคา</th>
                  <th scope="col" className="lottery-table-center">
                    กลับ
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="lottery-table-form-row">
                  <td>
                    <input
                      ref={numberInputRef}
                      id="lottery-number"
                      className="lottery-table-input lottery-table-number"
                      value={numberInput}
                      onChange={(event) => {
                        const next = normalizeDigits(event.target.value)
                          .replace(/\D/g, '')
                          .slice(0, 3);
                        setNumberInput(next);
                        setFormError(null);
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder="123"
                      aria-label="เลข"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </td>
                  <td>
                    <input
                      id="lottery-price"
                      className="lottery-table-input lottery-table-price"
                      value={priceInput}
                      onChange={(event) => {
                        setPriceInput(sanitizePriceInput(event.target.value));
                        setFormError(null);
                      }}
                      inputMode="decimal"
                      maxLength={8}
                      placeholder="30"
                      aria-label="ราคา"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </td>
                  <td className="lottery-table-center">
                    <input
                      type="checkbox"
                      checked={reverseInput}
                      onChange={(event) => setReverseInput(event.target.checked)}
                      aria-label="กลับเลข"
                    />
                  </td>
                  <td className="lottery-table-actions">
                    {editingId ? (
                      <>
                        <button
                          type="submit"
                          className="icon-btn lottery-table-save"
                          aria-label="บันทึก"
                          title="บันทึก"
                        >
                          <CheckIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={cancelEdit}
                          aria-label="ยกเลิก"
                          title="ยกเลิก"
                        >
                          <XIcon size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="submit"
                        className="lottery-table-add"
                        aria-label="เพิ่มเลข"
                        title="เพิ่มเลข"
                      >
                        <PlusIcon size={15} />
                      </button>
                    )}
                  </td>
                </tr>

                {entries.map((entry) => {
                  const match = matchesRestricted(entry.number, restricted, true);
                  const permutationCount = entry.reverse
                    ? uniquePermutations(entry.number).length
                    : 0;

                  return (
                    <tr className={match ? 'is-restricted' : undefined} key={entry.id}>
                      <td>
                        <span className="lottery-table-number-text">{entry.number}</span>
                        {match ? (
                          <span className="lottery-table-note">
                            {match.kind === 'exact'
                              ? `ตรงกับ ${match.matched}`
                              : `กลับของ ${match.matched}`}
                          </span>
                        ) : null}
                      </td>
                      <td className="lottery-table-price-text">
                        {formatEntryPrice(entry.price)}
                      </td>
                      <td className="lottery-table-center">
                        {entry.reverse ? (
                          <span
                            className="lottery-table-reverse is-on"
                            title={`กลับ ${permutationCount} เลข`}
                          >
                            {permutationCount}
                          </span>
                        ) : (
                          <span className="lottery-table-dash">-</span>
                        )}
                      </td>
                      <td className="lottery-table-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(entry)}
                          aria-label={`แก้ไข ${entry.number}`}
                          title="แก้ไข"
                        >
                          <PencilIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`ลบ ${entry.number}`}
                          title="ลบ"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="lottery-table-empty">
                      ยังไม่มีเลข — กรอกในตารางแล้วกด +
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {previewMatch ? (
            <p className="notice notice-warn" role="status">
              <AlertIcon size={16} />
              <span>
                {previewMatch.kind === 'exact'
                  ? `เลข ${previewMatch.number} อยู่ในเลขอั้น`
                  : `เลขกลับของ ${previewMatch.matched} อยู่ในเลขอั้น`}{' '}
                — จ่ายครึ่งเดียว
              </span>
            </p>
          ) : null}

          {formError ? (
            <p className="notice notice-error" role="alert">
              <AlertIcon size={16} />
              <span>{formError}</span>
            </p>
          ) : null}
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. สรุป                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="lottery-card lottery-summary-card" aria-labelledby="lottery-summary-title">
        <div className="lottery-section-head">
          <div>
            <h2 className="section-title" id="lottery-summary-title">
              สรุป
            </h2>
            <p className="section-sub">
              {summary.lines.length > 0
                ? `${summary.lines.length} เลข · คัดลอกเป็นบรรทัดได้เลย`
                : 'เพิ่มเลขเพื่อสร้างสรุป'}
            </p>
          </div>
          {summary.lines.length > 0 ? (
            <LotteryShareMenu mode="summary" label="แชร์สรุป" />
          ) : null}
        </div>

        {summary.lines.length === 0 ? (
          <div className="lottery-empty">
            <TicketIcon size={26} />
            <p>ยังไม่มีเลขในโพย</p>
            <p className="small muted">เพิ่มเลขด้านบนเพื่อดูสรุป</p>
          </div>
        ) : (
          <>
            {summary.restrictedCount > 0 ? (
              <p className="notice notice-warn">
                <AlertIcon size={16} />
                <span>พบเลขอั้น {summary.restrictedCount} เลข — จ่ายครึ่งเดียว</span>
              </p>
            ) : null}

            <div className="lottery-summary-box">
              <div className="lottery-summary-box-toolbar">
                <CopyButton
                  value={summaryText}
                  label="คัดลอกโพย"
                  copiedLabel="คัดลอกแล้ว"
                  className="lottery-summary-copy-button"
                  iconOnly
                />
              </div>
              <pre className="lottery-summary-copy">{summaryText}</pre>
            </div>

            <div className="lottery-total">
              <div className="lottery-total-head">
                <span className="lottery-total-label">
                  {discount > 0 ? 'ยอดสุทธิ' : 'รวมราคา'}
                </span>
                <button
                  type="button"
                  className={`lottery-discount-badge${discount === 25 ? ' is-active' : ''}`}
                  aria-pressed={discount === 25}
                  onClick={() => setDiscount((current) => (current === 25 ? 0 : 25))}
                >
                  ลด 25%
                </button>
              </div>
              <div className="lottery-total-value" aria-live="polite">
                <strong className="mono">{formatMoney(summary.discountedAmount)}</strong>
                <span>บาท</span>
              </div>
              {discount > 0 ? (
                <p className="lottery-total-note">
                  ก่อนลด {formatMoney(summary.totalAmount)} บาท − ส่วนลด {discount}%
                  ({formatMoney(summary.totalAmount - summary.discountedAmount)} บาท)
                </p>
              ) : null}
            </div>

            <div className="lottery-summary-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={clearEntries}>
                <TrashIcon size={15} /> ล้างโพย
              </button>
            </div>

            {shareStatus ? (
              <p className="notice notice-success" role="status">
                <CheckIcon size={16} />
                <span>{shareStatus}</span>
              </p>
            ) : null}

            {fullShareTooLong && summaryShareTooLong ? (
              <p className="notice notice-warn">
                <AlertIcon size={16} />
                <span>ข้อมูลยาวเกินไปสำหรับแชร์ — ลดจำนวนเลขก่อน</span>
              </p>
            ) : null}

          </>
        )}
      </section>

      <LotteryHistoryStats
        restricted={restricted}
        selectedDate={historyRound}
        selectedRound={historyRoundKey}
      />
    </div>
  );
}
