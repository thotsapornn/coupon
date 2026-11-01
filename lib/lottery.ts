/* ------------------------------------------------------------------ */
/* Lottery number helper                                                */
/* ------------------------------------------------------------------ */

import { decodeShareJson, encodeShareJson } from './share-codec';

export type LotteryDigits = 2 | 3;

export const DEFAULT_LOTTERY_PRICE = '30';

/** ตัวเลือกส่วนลดที่หักจากยอดรวมของโพย */
export const LOTTERY_DISCOUNTS = [0, 25] as const;
export type LotteryDiscount = (typeof LOTTERY_DISCOUNTS)[number];

export function isValidDiscount(value: unknown): value is LotteryDiscount {
  return (
    typeof value === 'number' &&
    (LOTTERY_DISCOUNTS as readonly number[]).includes(value)
  );
}

export interface RestrictedGroup {
  digits: LotteryDigits;
  numbers: string[];
  /** หัวข้อในรูประบุ “กลับ” หรือไม่ */
  reversed: boolean;
}

export interface ParsedRestricted {
  three: RestrictedGroup;
  two: RestrictedGroup;
  title?: string;
  closingTime?: string;
  /** รูประบุ “จ่ายครึ่ง” */
  halfPay: boolean;
  warnings: string[];
}

export interface LotteryEntry {
  id: string;
  number: string;
  /** ราคาแต่ละฝั่งที่กรอก (ตัวเลขเดี่ยว) — แสดงผลเป็น 30x30 */
  price: number;
  reverse: boolean;
}

export interface RestrictedMatch {
  number: string;
  matched: string;
  kind: 'exact' | 'reverse';
}

export interface SummaryLine {
  number: string;
  price: string;
  source: string;
  reversed: boolean;
  match: RestrictedMatch | null;
}

export interface LotterySummary {
  lines: SummaryLine[];
  restrictedCount: number;
  /** รวมจำนวนเงินก่อนส่วนลด */
  totalAmount: number;
  /** รวมจำนวนเงินหลังส่วนลด */
  discountedAmount: number;
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                        */
/* ------------------------------------------------------------------ */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const OCR_CONFUSABLES: Record<string, string> = {
  O: '0',
  o: '0',
  I: '1',
  l: '1',
  '|': '1',
  '!': '1',
  Z: '2',
  z: '2',
  A: '4',
  S: '5',
  s: '5',
  G: '6',
  T: '7',
  B: '8',
  g: '9',
  q: '9',
};

export function normalizeDigits(value: string): string {
  return value.replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));
}

function cleanToken(raw: string): string | null {
  // ต้องมีตัวเลขจริงอย่างน้อยหนึ่งตัว กันคำอังกฤษล้วนถูกแปลงเป็นเลข
  if (!/[0-9๐-๙]/.test(raw)) return null;

  const normalized = normalizeDigits(raw)
    .split('')
    .map((char) => OCR_CONFUSABLES[char] ?? char)
    .join('');

  return /^\d{2,3}$/.test(normalized) ? normalized : null;
}

const TOKEN_RE =
  /(?<![0-9๐-๙A-Za-z|])([0-9๐-๙OoIl|ZzSsGgTtBbAaq!]{2,3})(?![0-9๐-๙A-Za-z|])/g;

export function extractNumberTokens(line: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const match of line.matchAll(TOKEN_RE)) {
    const token = cleanToken(match[1]);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export function normalizeLotteryNumber(value: string): string | null {
  const cleaned = normalizeDigits(value).replace(/[\s\-–—]/g, '');
  return /^\d{2,3}$/.test(cleaned) ? cleaned : null;
}

/**
 * ราคาที่กรอกเป็นตัวเลขต่อฝั่ง เช่น 30 หรือ 30.5
 * (ตอนแสดงผลจะแปลงเป็น 30x30 และยอดรวมคิดทั้งบนกับล่าง)
 */
export function normalizePrice(value: string): number | null {
  const cleaned = value.replace(/[\s,]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const price = Number(cleaned);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function formatPriceNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** แสดงราคาบนและล่างจากราคาต่อฝั่ง เช่น 30 → 30x30 */
export function formatEntryPrice(price: number): string {
  const value = formatPriceNumber(price);
  return `${value}x${value}`;
}

export function formatMoney(value: number): string {
  return formatPriceNumber(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isValidLotteryEntry(value: unknown): value is LotteryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LotteryEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.number === 'string' &&
    /^\d{2,3}$/.test(entry.number) &&
    typeof entry.price === 'number' &&
    Number.isFinite(entry.price) &&
    entry.price > 0 &&
    typeof entry.reverse === 'boolean'
  );
}

/* ------------------------------------------------------------------ */
/* Share (JSON in query param)                                          */
/* ------------------------------------------------------------------ */

export interface SharedLotteryState {
  restrictedText: string;
  useRestricted: boolean;
  includeReversed: boolean;
  priceInput: string;
  discount: number;
  entries: LotteryEntry[];
  numberInput?: string;
  reverseInput?: boolean;
  historyRound?: string;
  editingId?: string;
}

const MAX_SHARE_LENGTH = 20_000;
const MAX_SHARED_ENTRIES = 500;

function parseSharedState(value: string): SharedLotteryState | null {
  try {
    const parsed = JSON.parse(value) as Partial<SharedLotteryState>;
    if (!parsed || typeof parsed !== 'object') return null;

    const restrictedText =
      typeof parsed.restrictedText === 'string'
        ? parsed.restrictedText.slice(0, MAX_SHARE_LENGTH)
        : '';
    const useRestricted =
      typeof parsed.useRestricted === 'boolean' ? parsed.useRestricted : true;
    const includeReversed =
      typeof parsed.includeReversed === 'boolean' ? parsed.includeReversed : true;
    const normalizedInput =
      typeof parsed.priceInput === 'string' ? normalizePrice(parsed.priceInput) : null;
    const priceInput = normalizedInput === null ? DEFAULT_LOTTERY_PRICE : String(normalizedInput);
    const discount = isValidDiscount(parsed.discount) ? parsed.discount : 0;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(isValidLotteryEntry).slice(0, MAX_SHARED_ENTRIES)
      : [];
    const numberInput =
      typeof parsed.numberInput === 'string' && /^\d{0,3}$/.test(parsed.numberInput)
        ? parsed.numberInput
        : undefined;
    const reverseInput =
      typeof parsed.reverseInput === 'boolean' ? parsed.reverseInput : undefined;
    const historyRound =
      typeof parsed.historyRound === 'string' &&
      /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(parsed.historyRound)
        ? parsed.historyRound
        : undefined;
    const editingId =
      typeof parsed.editingId === 'string' && entries.some((entry) => entry.id === parsed.editingId)
        ? parsed.editingId
        : undefined;

    return {
      restrictedText,
      useRestricted,
      includeReversed,
      priceInput,
      discount,
      entries,
      ...(numberInput !== undefined ? { numberInput } : {}),
      ...(reverseInput !== undefined ? { reverseInput } : {}),
      ...(historyRound !== undefined ? { historyRound } : {}),
      ...(editingId !== undefined ? { editingId } : {}),
    };
  } catch {
    return null;
  }
}

/** เข้ารหัส JSON แบบ Base64 URL-safe สำหรับใส่ query param */
export function encodeLotteryShare(state: SharedLotteryState): string {
  return encodeShareJson(state);
}

/** รองรับทั้งค่าที่ถูก decode แล้ว (จาก searchParams) และค่าที่ encode อยู่ */
export function decodeLotteryShare(value?: string | null): SharedLotteryState | null {
  if (!value || value.length > MAX_SHARE_LENGTH) return null;

  const candidates = [value];
  const base64Json = decodeShareJson(value);
  if (base64Json && typeof base64Json === 'object') {
    candidates.push(JSON.stringify(base64Json));
  }
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    /* ไม่ใช่ percent-encoding — ลอง parse ค่าเดิม */
  }

  for (const candidate of candidates) {
    const state = parseSharedState(candidate);
    if (state) return state;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Parsing เลขอั้น                                                       */
/* ------------------------------------------------------------------ */

function detectGroup(line: string): LotteryDigits | null {
  const hasThree = /(เต็ง|เด็ง|โต๊ด|โค้|3\s*[-–—]\s*6|3\s*ตัว)/.test(line);
  const hasTwo = /(บน|ล่าง|2\s*ตัว|วิ่ง)/.test(line);

  if (hasThree && hasTwo) {
    return /2\s*ตัว/.test(line) ? 2 : 3;
  }
  if (hasThree) return 3;
  if (hasTwo) return 2;
  return null;
}

function isReversedHeader(line: string): boolean {
  return /(กลับ|คลับ|กลัย)/.test(line);
}

const SKIP_LINE =
  /(เวลา|ปิดรับ|โทร|เบอร์|วันที่|งวด|เดือน|ปี|ราคา|จ่าย|บาท|เขียน|หมายเหตุ|อันดับ|ผลรางวัล|รางวัล|[A-Za-z]{2,})/;

function shouldExtract(line: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  if (tokens.length >= 2) return true;

  // บรรทัดอย่าง “เลข 049” หรือ “เลขท้าย 3 ตัว 049” ยังควรอ่าน
  const withoutLabels = line
    .replace(/(?:เลข(?:ท้าย|หน้า|บน|ล่าง)?|3\s*ตัว|2\s*ตัว|ตัว)\s*[:：]?/g, '')
    .trim();
  if (!/[\u0E00-\u0E7F]/.test(withoutLabels)) return true;

  return /[:：]/.test(line) || /ตัว/.test(line);
}

export function parseRestrictedNumbers(text: string): ParsedRestricted {
  const normalized = normalizeDigits(
    text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, ''),
  );
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const three = new Set<string>();
  const two = new Set<string>();
  const warnings = new Set<string>();

  let current: LotteryDigits | null = null;
  let threeReversed = false;
  let twoReversed = false;
  let title: string | undefined;
  let closingTime: string | undefined;
  let halfPay = false;

  for (const line of lines) {
    if (!title && /(เลขอั้น|เลขอัน)/.test(line)) {
      const tokens = extractNumberTokens(line);
      const looksLikeDate =
        /\d{1,2}\s*[\/.]\s*\d{1,2}\s*[\/.]\s*\d{2,4}/.test(line) ||
        /(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/.test(
          line,
        );
      // บรรทัดหัวเรื่องมักมีแค่วันที่ (เช่น 1 พ.ย. 69) — ถ้าเป็นรายการเลขจริงให้อ่านต่อ
      if (tokens.length <= 1 || looksLikeDate) {
        title = line.replace(/\s+/g, ' ').trim();
        continue;
      }
    }

    const timeMatch = line.match(/(?:ปิดรับเวลา|ปิดรับ)\s*(\d{1,2})\s*[.:]\s*(\d{2})/);
    if (timeMatch) {
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        closingTime = `${String(hour).padStart(2, '0')}:${timeMatch[2]}`;
      }
      continue;
    }

    if (/(จ่ายครึ่ง|จ่ายครึง|ครึ่งเดียว|ครึงเดียว)/.test(line)) halfPay = true;

    const group = detectGroup(line);
    if (group) {
      current = group;
      const reversed = isReversedHeader(line);
      if (group === 3) threeReversed = threeReversed || reversed;
      else twoReversed = twoReversed || reversed;
      // ไม่ continue — บรรทัดอย่าง “เลขท้าย 3 ตัว: 049 059” มีเลขอยู่ในบรรทัดเดียวกัน
    }

    if (SKIP_LINE.test(line)) continue;

    const tokens = extractNumberTokens(line);
    if (!shouldExtract(line, tokens)) continue;

    for (const token of tokens) {
      if (current === 3) {
        if (token.length === 3) {
          three.add(token);
        } else {
          two.add(token);
          warnings.add(`พบเลข 2 หลัก “${token}” ในกลุ่ม 3 ตัว — ตรวจสอบว่า OCR ตกเลขหน้าหรือไม่`);
        }
      } else if (current === 2) {
        if (token.length === 2) {
          two.add(token);
        } else {
          three.add(token);
          warnings.add(`พบเลข 3 หลัก “${token}” ในกลุ่ม 2 ตัว — ตรวจสอบว่า OCR เกินมาหรือไม่`);
        }
      } else if (token.length === 3) {
        three.add(token);
      } else {
        two.add(token);
      }
    }
  }

  if (three.size === 0 && two.size === 0 && /\d/.test(normalized)) {
    warnings.add('อ่านเลขจากข้อความไม่พบ — ตรวจข้อความหรือกรอกเลขเอง');
  }

  return {
    three: { digits: 3, numbers: [...three], reversed: threeReversed },
    two: { digits: 2, numbers: [...two], reversed: twoReversed },
    title,
    closingTime,
    halfPay,
    warnings: [...warnings],
  };
}

/* ------------------------------------------------------------------ */
/* Reversal + matching                                                  */
/* ------------------------------------------------------------------ */

export function uniquePermutations(value: string): string[] {
  const digits = value.split('');
  const result = new Set<string>();

  function walk(prefix: string, remaining: string[]): void {
    if (remaining.length === 0) {
      result.add(prefix);
      return;
    }
    const used = new Set<string>();
    for (let index = 0; index < remaining.length; index += 1) {
      const digit = remaining[index];
      if (used.has(digit)) continue;
      used.add(digit);
      walk(prefix + digit, [
        ...remaining.slice(0, index),
        ...remaining.slice(index + 1),
      ]);
    }
  }

  walk('', digits);
  return [...result].sort();
}

export function matchesRestricted(
  value: string,
  restricted: ParsedRestricted,
  includeReversed = true,
): RestrictedMatch | null {
  const group =
    value.length === 3 ? restricted.three : value.length === 2 ? restricted.two : null;
  if (!group || group.numbers.length === 0) return null;

  if (group.numbers.includes(value)) {
    return { number: value, matched: value, kind: 'exact' };
  }

  if (!includeReversed) return null;

  for (const candidate of uniquePermutations(value)) {
    if (candidate === value) continue;
    if (group.numbers.includes(candidate)) {
      return { number: value, matched: candidate, kind: 'reverse' };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Summary                                                              */
/* ------------------------------------------------------------------ */

export function buildLotterySummary(
  entries: LotteryEntry[],
  restricted: ParsedRestricted,
  options: { useRestricted?: boolean; includeReversed?: boolean; discount?: number } = {},
): LotterySummary {
  const { useRestricted = true, includeReversed = true, discount = 0 } = options;
  const lines: SummaryLine[] = [];
  let totalAmount = 0;

  for (const entry of entries) {
    const numbers = entry.reverse
      ? [
          entry.number,
          ...uniquePermutations(entry.number).filter((value) => value !== entry.number),
        ]
      : [entry.number];
    for (const number of numbers) {
      totalAmount += entry.price * 2;
      lines.push({
        number,
        price: formatEntryPrice(entry.price),
        source: entry.number,
        reversed: number !== entry.number,
        match: useRestricted
          ? matchesRestricted(number, restricted, includeReversed)
          : null,
      });
    }
  }

  const roundedTotal = roundMoney(totalAmount);

  return {
    lines,
    restrictedCount: lines.filter((line) => line.match !== null).length,
    totalAmount: roundedTotal,
    discountedAmount: roundMoney(roundedTotal * (1 - discount / 100)),
  };
}

export function formatSummaryLine(
  line: SummaryLine,
  options: { includeWarning?: boolean } = {},
): string {
  const base = `${line.number} = ${line.price}`;
  return options.includeWarning && line.match ? `${base} (จ่ายครึ่ง)` : base;
}

export function summaryToText(
  lines: SummaryLine[],
  options: { includeWarning?: boolean } = {},
): string {
  return lines.map((line) => formatSummaryLine(line, options)).join('\n');
}

export function lotterySummaryToText(
  summary: LotterySummary,
  options: { discount?: number; includeWarning?: boolean } = {},
): string {
  const { discount = 0, includeWarning = false } = options;
  const lines = summaryToText(summary.lines, { includeWarning });
  const totalLines = discount
    ? [
        `รวมราคา: ${formatMoney(summary.totalAmount)} บาท`,
        `ส่วนลด ${discount}%: -${formatMoney(summary.totalAmount - summary.discountedAmount)} บาท`,
        `ยอดสุทธิ: ${formatMoney(summary.discountedAmount)} บาท`,
      ]
    : [`รวมราคา: ${formatMoney(summary.totalAmount)} บาท`];

  return [lines, ...totalLines].filter(Boolean).join('\n');
}
