import { ApiError, type ApiErrorCode } from '../errors';
import type {
  Coupon,
  CouponImageInput,
  CouponInput,
  ListCouponsOptions,
  ListResult,
  UsageLog,
} from '../types';

const GAS_URL = process.env.GAS_WEB_APP_URL;
const GAS_SECRET = process.env.GAS_SHARED_SECRET;

export function isGasConfigured(): boolean {
  return Boolean(GAS_URL && GAS_SECRET);
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: ApiErrorCode; message?: string; fields?: Record<string, string> };
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!GAS_URL || !GAS_SECRET) {
    throw new ApiError('INTERNAL_ERROR', 'ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL / GAS_SHARED_SECRET', 500);
  }

  let response: Response;
  try {
    response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Coupon-Token': GAS_SECRET,
      },
      // Apps Script ไม่สามารถอ่าน custom header ได้ จึงส่ง token ไปใน body ด้วย
      body: JSON.stringify({ action, payload, token: GAS_SECRET }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
      redirect: 'follow',
    });
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ApiError('UPSTREAM_TIMEOUT', 'Google Apps Script ใช้เวลานานเกินไป กรุณาลองใหม่', 504);
    }
    throw new ApiError('INTERNAL_ERROR', 'เชื่อมต่อ Google Apps Script ไม่ได้', 502);
  }

  if (!response.ok) {
    throw new ApiError('INTERNAL_ERROR', `Apps Script ตอบกลับผิดพลาด (${response.status})`, 502);
  }

  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'อ่านคำตอบจาก Apps Script ไม่ได้', 502);
  }

  if (!envelope.ok || !envelope.data) {
    const code = envelope.error?.code ?? 'INTERNAL_ERROR';
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'INVALID_STATE'
          ? 409
          : code === 'VALIDATION_ERROR'
            ? 400
            : code === 'UNAUTHORIZED'
              ? 401
              : code === 'RATE_LIMITED'
                ? 429
                : 502;
    throw new ApiError(code, envelope.error?.message ?? 'เกิดข้อผิดพลาดจาก Apps Script', status, envelope.error?.fields);
  }

  return envelope.data;
}

export async function listCoupons(options: ListCouponsOptions): Promise<ListResult> {
  return call<ListResult>('listCoupons', {
    userId: options.userId,
    status: options.status ?? 'all',
    q: options.q ?? '',
    limit: options.limit ?? 500,
  });
}

/** admin: คูปองของทุก user */
export async function listAllCoupons(
  options: Omit<ListCouponsOptions, 'userId'>,
): Promise<ListResult> {
  return call<ListResult>('adminListCoupons', {
    status: options.status ?? 'all',
    q: options.q ?? '',
    limit: options.limit ?? 500,
  });
}

/** admin: ลบถาวรได้ทุก user */
export async function purgeCouponAny(couponId: string): Promise<void> {
  await call<{ couponId: string; deleted: boolean }>('adminPurgeCoupon', { couponId });
}

export async function getSharedCoupon(couponId: string): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('getSharedCoupon', { couponId });
  return data.coupon;
}

export async function getCoupon(couponId: string, userId: string): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('getCoupon', { couponId, userId });
  return data.coupon;
}

export async function createCoupon(
  userId: string,
  input: CouponInput,
  image?: CouponImageInput,
): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('createCoupon', {
    ...input,
    userId,
    imageBase64: image?.base64,
    imageMimeType: image?.mimeType,
  });
  return data.coupon;
}

export async function updateCoupon(
  couponId: string,
  userId: string,
  patch: Partial<CouponInput>,
): Promise<Coupon> {
  // ค่า undefined หมายถึง "ล้างฟิลด์" — JSON.stringify จะตัดทิ้ง จึงแปลงเป็น '' ก่อนส่ง
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    normalized[key] = value === undefined ? '' : value;
  }
  const data = await call<{ coupon: Coupon }>('updateCoupon', {
    couponId,
    userId,
    patch: normalized,
  });
  return data.coupon;
}

export async function markUsed(couponId: string, userId: string): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('markUsed', { couponId, userId });
  return data.coupon;
}

export async function undoUsed(couponId: string, userId: string): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('undoUsed', { couponId, userId });
  return data.coupon;
}

export async function deleteCoupon(couponId: string, userId: string): Promise<Coupon> {
  const data = await call<{ coupon: Coupon }>('deleteCoupon', { couponId, userId });
  return data.coupon;
}

/** ลบถาวร (admin) — ลบแถวใน Sheets + ไฟล์ใน Drive, กู้คืนไม่ได้ */
export async function purgeCoupon(couponId: string, userId: string): Promise<void> {
  await call<{ couponId: string; deleted: boolean }>('purgeCoupon', { couponId, userId });
}

export async function listHistory(couponId: string, userId: string): Promise<UsageLog[]> {
  const data = await call<{ logs: UsageLog[] }>('listHistory', { couponId, userId });
  return data.logs;
}

export async function getStats(userId: string): Promise<{
  total: number;
  unused: number;
  used: number;
  expiring: number;
  expired: number;
}> {
  const data = await call<{
    total: number;
    unused: number;
    used: number;
    expiring: number;
    expired: number;
  }>('getStats', { userId });
  return data;
}
