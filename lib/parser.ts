import type { ParsedCouponFields, QrType } from './types';
import { nowIso, todayBangkok, truncate } from './format';

/* ------------------------------------------------------------------ */
/* Text normalisation                                                   */
/* ------------------------------------------------------------------ */

export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1].length > 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** กัน formula injection ก่อนเขียนลง Google Sheets */
export function sanitizeForSheet(value: string): string {
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

/** ใช้ตรวจคูปองซ้ำ — normalize เฉพาะตอนเทียบ ไม่แก้ค่าที่เก็บ */
export function normalizeForCompare(value?: string): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\/+$/, '');
}

export function detectQrType(raw?: string): QrType {
  if (!raw || !raw.trim()) return 'unknown';
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^[\[{]/.test(value)) {
    try {
      JSON.parse(value);
      return 'json';
    } catch {
      return 'unknown';
    }
  }
  if (/^[A-Z0-9][A-Z0-9._:-]{2,120}$/i.test(value)) return 'plain_code';
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Merchant                                                             */
/* ------------------------------------------------------------------ */

const HOST_MERCHANTS: Array<[string, string]> = [
  ['shopee', 'Shopee'],
  ['lazada', 'Lazada'],
  ['grab.com', 'Grab'],
  ['grab', 'Grab'],
  ['lineman', 'LINE MAN'],
  ['robinhood', 'Robinhood'],
  ['foodpanda', 'foodpanda'],
  ['starbucks', 'Starbucks'],
  ['agoda', 'Agoda'],
  ['booking.com', 'Booking.com'],
  ['klook', 'Klook'],
  ['tiktok', 'TikTok Shop'],
  ['central', 'Central'],
  ['lotuss', 'Lotus\u2019s'],
  ['bigc', 'Big C'],
  ['tops', 'Tops'],
  ['wongnai', 'Wongnai'],
];

const BRANDS: string[] = [
  'Shopee', 'Lazada', 'GrabFood', 'Grab', 'LINE MAN', 'Robinhood', 'foodpanda',
  'Starbucks', 'McDonald\u2019s', 'KFC', 'Burger King', 'Pizza Hut', 'Domino\u2019s',
  'Central', 'Lotus\u2019s', 'Big C', 'Tops', '7-Eleven', 'CJ More', 'Kerry',
  'Flash Express', 'TrueMoney', 'AIS', 'dtac', 'True', 'Netflix', 'Spotify',
  'Agoda', 'Booking.com', 'Klook', 'TikTok Shop', 'Wongnai', 'MK', 'Sizzler',
  'After You', 'ChaTraMue', 'Amazon', 'ShopeeFood', 'LINEMAN',
];

export function detectMerchant(text: string, qrRawValue?: string): string | undefined {
  if (qrRawValue && /^https?:\/\//i.test(qrRawValue)) {
    try {
      const host = new URL(qrRawValue).hostname.toLowerCase();
      for (const [needle, name] of HOST_MERCHANTS) {
        if (host.includes(needle)) return name;
      }
    } catch {
      /* ignore malformed URL */
    }
  }

  const haystack = text.toLowerCase();
  let best: { index: number; name: string } | undefined;
  for (const brand of BRANDS) {
    const index = haystack.indexOf(brand.toLowerCase());
    if (index === -1) continue;
    if (!best || index < best.index || (index === best.index && brand.length > best.name.length)) {
      best = { index, name: brand };
    }
  }
  return best?.name;
}

/* ------------------------------------------------------------------ */
/* Discount                                                             */
/* ------------------------------------------------------------------ */

export function extractDiscount(text: string): string | undefined {
  const patterns: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
    { regex: /(?:ลด(?:สูงสุด)?|ส่วนลด)\s*([0-9]{1,2})\s*%/i, format: (m) => `ลด ${m[1]}%` },
    {
      regex: /(?:ส่วนลด|ลด)\s*([0-9][0-9,]{0,5})\s*(?:บาท|฿|thb|\.-)/i,
      format: (m) => `ลด ${m[1].replace(/,/g, '')} บาท`,
    },
    { regex: /(\d+)\s*แถม\s*(\d+)/, format: (m) => `${m[1]} แถม ${m[2]}` },
    { regex: /ฟรี\s*([^\n]{1,30})/i, format: (m) => `ฟรี ${m[1].trim()}` },
  ];

  let base: string | undefined;
  for (const { regex, format } of patterns) {
    const match = text.match(regex);
    if (match) {
      base = format(match);
      break;
    }
  }

  const minSpend = text.match(/ขั้นต่ำ\s*([0-9,]{1,6})\s*(?:บาท|฿)?/i);
  if (minSpend) {
    const condition = `ขั้นต่ำ ${minSpend[1].replace(/,/g, '')} บาท`;
    if (!base) return condition;
    if (!base.includes('ขั้นต่ำ')) return `${base} ${condition}`;
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Coupon code                                                          */
/* ------------------------------------------------------------------ */

export function extractCouponCode(text: string): string | undefined {
  const labelled =
    /(?:โค้ด|รหัส(?:คูปอง)?|coupon\s*code|promo\s*code|code)\s*[:：\-]?\s*([A-Z0-9][A-Z0-9_-]{3,24})/i;
  const match = text.match(labelled);
  if (match) return match[1].toUpperCase();

  for (const line of text.split('\n')) {
    const token = line.trim();
    if (/^[A-Z0-9][A-Z0-9_-]{4,19}$/.test(token) && /[A-Z]/.test(token) && /\d/.test(token)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(token)) continue; // วันที่ ไม่ใช่โค้ด
      return token;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Expiry date                                                          */
/* ------------------------------------------------------------------ */

export interface ExpiryParseResult {
  date?: string;
  ambiguous: boolean;
  buddhist: boolean;
  raw?: string;
}

const THAI_MONTH_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const THAI_MONTH_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const CONTEXT = /(หมดอายุ|ใช้ได้ถึง|ใช้ได้จนถึง|ใช้ก่อน|ใช้ได้ภายใน|valid\s*(?:until|thru|thru\.)?|expir)/i;

interface Candidate {
  index: number;
  date?: string;
  ambiguous: boolean;
  buddhist: boolean;
  raw: string;
  score: number;
}

function toCeYear(year: number): { year?: number; ambiguous: boolean; buddhist: boolean } {
  if (year >= 2400 && year <= 2699) {
    return { year: year - 543, ambiguous: false, buddhist: true };
  }
  if (year >= 2000 && year <= 2100) {
    return { year, ambiguous: false, buddhist: false };
  }
  if (year >= 0 && year <= 99) {
    return { ambiguous: true, buddhist: false };
  }
  return { ambiguous: false, buddhist: false };
}

function buildDate(year: number, month: number, day: number): string | undefined {
  if (year < 2000 || year > 2100) return undefined;
  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function scoreAt(text: string, index: number): number {
  const before = text.slice(Math.max(0, index - 45), index);
  return CONTEXT.test(before) ? 10 : 0;
}

export function extractExpiry(text: string): ExpiryParseResult {
  if (!text) return { ambiguous: false, buddhist: false };

  const candidates: Candidate[] = [];
  const consumed: Array<[number, number]> = [];

  // 1) ISO: 2026-12-31
  for (const match of text.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)) {
    const index = match.index ?? 0;
    const [raw, y, m, d] = match;
    const { year, buddhist } = toCeYear(Number(y));
    const date = year ? buildDate(year, Number(m), Number(d)) : undefined;
    if (!date) continue;
    candidates.push({ index, date, ambiguous: false, buddhist, raw, score: scoreAt(text, index) });
    consumed.push([index, index + raw.length]);
  }

  const isConsumed = (index: number) =>
    consumed.some(([start, end]) => index >= start && index < end);

  // 2) Thai month abbreviations / full names: 31 ธ.ค. 2569
  const monthAlternation = [...THAI_MONTH_ABBR, ...THAI_MONTH_FULL]
    .map((name) => name.replace(/\./g, '\\.'))
    .join('|');
  const thaiMonthRegex = new RegExp(`(\\d{1,2})\\s*(${monthAlternation})\\s*(\\d{2,4})`, 'g');
  for (const match of text.matchAll(thaiMonthRegex)) {
    const index = match.index ?? 0;
    if (isConsumed(index)) continue;
    const [raw, d, monthName, y] = match;
    const monthIndex = [...THAI_MONTH_ABBR, ...THAI_MONTH_FULL].findIndex(
      (name) => name.toLowerCase() === monthName.toLowerCase(),
    );
    const month = (monthIndex % 12) + 1;
    const { year, ambiguous, buddhist } = toCeYear(Number(y));
    const date = year ? buildDate(year, month, Number(d)) : undefined;
    candidates.push({
      index,
      date,
      ambiguous: ambiguous || !date,
      buddhist,
      raw,
      score: scoreAt(text, index),
    });
  }

  // 3) d/m/y หรือ d.m.y หรือ d-m-y (ค.ศ./พ.ศ.)
  for (const match of text.matchAll(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g)) {
    const index = match.index ?? 0;
    if (isConsumed(index)) continue;
    const [raw, first, second, y] = match;
    let day = Number(first);
    let month = Number(second);
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const { year, ambiguous, buddhist } = toCeYear(Number(y));
    const date = year ? buildDate(year, month, day) : undefined;
    candidates.push({
      index,
      date,
      ambiguous: ambiguous || !date,
      buddhist,
      raw,
      score: scoreAt(text, index),
    });
  }

  if (candidates.length === 0) return { ambiguous: false, buddhist: false };

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = candidates[0];
  const hasContext = best.score > 0;

  if (best.ambiguous) {
    return { ambiguous: true, buddhist: best.buddhist, raw: best.raw };
  }
  if (!best.date) {
    return { ambiguous: true, buddhist: best.buddhist, raw: best.raw };
  }

  const distinct = new Set(candidates.filter((c) => c.date).map((c) => c.date));
  if (!hasContext && distinct.size > 1) {
    return { ambiguous: true, buddhist: best.buddhist, raw: best.raw };
  }

  return { date: best.date, ambiguous: false, buddhist: best.buddhist, raw: best.raw };
}

/* ------------------------------------------------------------------ */
/* Auto naming                                                          */
/* ------------------------------------------------------------------ */

export function buildTitle(
  merchant: string | undefined,
  discount: string | undefined,
  createdAt: string = nowIso(),
): string {
  if (merchant && discount) return truncate(`${merchant} — ${discount}`, 100);
  if (merchant) return truncate(`${merchant} — คูปอง`, 100);
  if (discount) return truncate(discount, 100);

  const datePart = createdAt.slice(0, 10) || todayBangkok();
  const timePart = createdAt.slice(11, 16);
  return `คูปอง ${datePart} ${timePart}`.trim();
}

/* ------------------------------------------------------------------ */
/* Title from description                                               */
/* ------------------------------------------------------------------ */

/**
 * ตัดอักขระพิเศษ/อิโมจิออก เหลือเฉพาะตัวอักษรไทย/อังกฤษ ตัวเลข และช่องว่าง
 * (เครื่องหมาย %, จุด, ขีด, วงเล็บ, อิโมจิ ฯลฯ จะกลายเป็นช่องว่าง)
 */
export function stripSpecialChars(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[^\u0E00-\u0E7F\u00C0-\u024FA-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace >= Math.floor(max * 0.6) ? cut.slice(0, lastSpace) : cut;
  return trimmed.trim();
}

export function buildTitleFromDescription(description: string): string | undefined {
  const cleaned = stripSpecialChars(description);
  if (!cleaned) return undefined;
  return truncateAtWord(cleaned, 100);
}

/* ------------------------------------------------------------------ */
/* Combined parse                                                       */
/* ------------------------------------------------------------------ */

export interface ParseCouponInput {
  text: string;
  qrRawValue?: string;
  createdAt?: string;
}

export function parseCouponFields({
  text,
  qrRawValue,
  createdAt = nowIso(),
}: ParseCouponInput): ParsedCouponFields {
  const cleaned = cleanOcrText(text);
  const merchant = detectMerchant(cleaned, qrRawValue);
  const discountText = extractDiscount(cleaned);
  const couponCode = extractCouponCode(cleaned);
  const expiry = extractExpiry(cleaned);
  const description = truncate(cleaned.replace(/\n+/g, ' · '), 100);
  const titleFromDescription = buildTitleFromDescription(description);
  const title = titleFromDescription ?? buildTitle(merchant, discountText, createdAt);
  const warnings: string[] = [];

  if (!titleFromDescription) {
    warnings.push('ข้อความจาก OCR ว่างหรืออ่านไม่ออก กรุณาตรวจสอบชื่อคูปอง');
  }
  if (expiry.ambiguous) {
    warnings.push(`ไม่แน่ใจวันหมดอายุ (อ่านได้ “${expiry.raw ?? ''}”) กรุณายืนยันก่อนบันทึก`);
  } else if (expiry.buddhist) {
    warnings.push('แปลงปีพุทธศักราชเป็นคริสต์ศักราชแล้ว กรุณาตรวจสอบ');
  }

  return {
    title,
    merchant,
    discountText,
    couponCode,
    expiryDate: expiry.date,
    description,
    warnings,
  };
}
