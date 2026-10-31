import type { Coupon, DisplayStatus } from './types';

export const TZ = 'Asia/Bangkok';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export function nearExpiryDays(): number {
  const raw = Number(process.env.NEXT_PUBLIC_NEAR_EXPIRY_DAYS ?? 3);
  return Number.isFinite(raw) && raw >= 0 ? raw : 3;
}

interface BangkokParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function bangkokParts(date = new Date()): BangkokParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === '24' ? '00' : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** วันที่วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayBangkok(date = new Date()): string {
  const p = bangkokParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** เวลาปัจจุบันในรูปแบบ ISO 8601 พร้อม offset +07:00 */
export function nowIso(date = new Date()): string {
  const p = bangkokParts(date);
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${millis}+07:00`;
}

/** แปลง YYYY-MM-DD เป็นวันที่แบบอ่านง่าย: 31 ธ.ค. 2026 */
export function formatThaiDate(value?: string): string {
  if (!value) return 'ไม่มีวันหมดอายุ';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  const monthIndex = Number(mo) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  return `${Number(d)} ${THAI_MONTHS_SHORT[monthIndex]} ${y}`;
}

export function formatThaiDateLong(value?: string): string {
  if (!value) return 'ไม่มีวันหมดอายุ';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  const monthIndex = Number(mo) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  return `${Number(d)} ${THAI_MONTHS_FULL[monthIndex]} ${y}`;
}

/** 31 ต.ค. 2026 14:05 */
export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = bangkokParts(date);
  return `${Number(p.day)} ${THAI_MONTHS_SHORT[Number(p.month) - 1]} ${p.year} ${p.hour}:${p.minute}`;
}

export function formatDateCompact(value?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return value ?? '';
  return `${match[3]}/${match[2]}/${match[1].slice(2)}`;
}

export function formatDateShort(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = bangkokParts(date);
  return `${p.day}/${p.month}/${p.year}`;
}

/** จำนวนวันจากวันนี้ถึงวันที่กำหนด (ติดลบ = ผ่านไปแล้ว) */
export function daysUntil(dateStr: string, now = new Date()): number {
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.NaN;
  const today = Date.parse(`${todayBangkok(now)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export function getDisplayStatus(coupon: Pick<Coupon, 'status' | 'expiryDate'>, now = new Date()): DisplayStatus {
  if (coupon.status === 'used') return 'used';
  if (!coupon.expiryDate) return 'unused';
  const days = daysUntil(coupon.expiryDate, now);
  if (Number.isNaN(days)) return 'unused';
  if (days < 0) return 'expired';
  if (days <= nearExpiryDays()) return 'expiring';
  return 'unused';
}

export type ExpiryTone = 'neutral' | 'warn' | 'danger' | 'muted';

export function getExpiryLabel(
  coupon: Pick<Coupon, 'status' | 'expiryDate'>,
  now = new Date(),
): { text: string; tone: ExpiryTone } {
  if (coupon.status === 'used') {
    return { text: 'ใช้แล้ว', tone: 'muted' };
  }
  if (!coupon.expiryDate) {
    return { text: 'ไม่มีวันหมดอายุ', tone: 'neutral' };
  }
  const days = daysUntil(coupon.expiryDate, now);
  if (Number.isNaN(days)) {
    return { text: formatThaiDate(coupon.expiryDate), tone: 'neutral' };
  }
  if (days < 0) {
    return { text: `หมดอายุเมื่อ ${formatThaiDate(coupon.expiryDate)}`, tone: 'danger' };
  }
  if (days === 0) return { text: 'หมดอายุวันนี้', tone: 'danger' };
  if (days <= nearExpiryDays()) return { text: `เหลือ ${days} วัน`, tone: 'warn' };
  return { text: `ถึง ${formatThaiDate(coupon.expiryDate)}`, tone: 'neutral' };
}

export function getCardExpiryLabel(
  coupon: Pick<Coupon, 'status' | 'expiryDate'>,
  now = new Date(),
): { text: string; tone: ExpiryTone } {
  if (coupon.status === 'used') return { text: 'ใช้แล้ว', tone: 'muted' };
  if (!coupon.expiryDate) return { text: 'ไม่มีวันหมดอายุ', tone: 'neutral' };

  const days = daysUntil(coupon.expiryDate, now);
  if (Number.isNaN(days)) return { text: formatDateCompact(coupon.expiryDate), tone: 'neutral' };
  if (days < 0) return { text: `หมดอายุ ${formatDateCompact(coupon.expiryDate)}`, tone: 'danger' };
  if (days === 0) return { text: 'หมดอายุวันนี้', tone: 'danger' };
  if (days <= nearExpiryDays()) return { text: `เหลือ ${days} วัน`, tone: 'warn' };
  return { text: `ถึง ${formatDateCompact(coupon.expiryDate)}`, tone: 'neutral' };
}

export function statusLabel(status: DisplayStatus): string {
  switch (status) {
    case 'used':
      return 'ใช้แล้ว';
    case 'expired':
      return 'หมดอายุ';
    case 'expiring':
      return 'ใกล้หมดอายุ';
    default:
      return 'ยังไม่ใช้';
  }
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
