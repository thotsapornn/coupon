import { createHmac, timingSafeEqual } from 'node:crypto';

/** user id ที่หน้า admin ดูแล (เห็น/ลบได้เฉพาะของ id นี้) */
export const ADMIN_USER_ID = 'admintatar';

export const ADMIN_COOKIE = 'cw_admin';
export const ADMIN_TTL_SECONDS = 12 * 60 * 60;

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** เทียบรหัสแบบ constant-time เพื่อกันการวัดเวลา */
export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = Buffer.from(String(input));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return timingSafeEqual(given, wanted);
}

export function createAdminSession(now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) throw new Error('ยังไม่ได้ตั้งค่า ADMIN_PASSWORD');
  const expiresAt = Math.floor(now / 1000) + ADMIN_TTL_SECONDS;
  const signature = createHmac('sha256', secret).update(String(expiresAt)).digest('hex');
  return `${expiresAt}.${signature}`;
}

export function verifyAdminSession(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const secret = sessionSecret();
  if (!secret) return false;

  const separator = token.indexOf('.');
  if (separator <= 0) return false;

  const expiresRaw = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= now) return false;

  const expected = createHmac('sha256', secret).update(expiresRaw).digest('hex');
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return timingSafeEqual(given, wanted);
}

export async function isAdminRequest(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}
