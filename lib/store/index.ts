import { revalidateTag, unstable_cache } from 'next/cache';
import { ApiError } from '../errors';
import * as demo from './demo';
import * as gas from './gas';
import type {
  Coupon,
  CouponImageInput,
  CouponInput,
  ListCouponsOptions,
  ListResult,
  ShareKind,
  ShareRecord,
  UsageLog,
} from '../types';

export type StoreMode = 'demo' | 'gas';

export function storeMode(): StoreMode {
  return gas.isGasConfigured() ? 'gas' : 'demo';
}

const LIST_TAG = 'coupons';
const couponTag = (couponId: string) => `coupon:${couponId}`;
const CACHE_SECONDS = 30;

function invalidate(couponId?: string): void {
  revalidateTag(LIST_TAG, { expire: 0 });
  if (couponId) revalidateTag(couponTag(couponId), { expire: 0 });
}

const cachedListCoupons = unstable_cache(
  async (options: ListCouponsOptions): Promise<ListResult> =>
    storeMode() === 'gas' ? gas.listCoupons(options) : demo.listCoupons(options),
  ['listCoupons'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function listCoupons(options: ListCouponsOptions): Promise<ListResult> {
  return cachedListCoupons(options);
}

const cachedListAllCoupons = unstable_cache(
  async (options: Omit<ListCouponsOptions, 'userId'>): Promise<ListResult> =>
    storeMode() === 'gas' ? gas.listAllCoupons(options) : demo.listAllCoupons(options),
  ['listAllCoupons'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function listAllCoupons(
  options: Omit<ListCouponsOptions, 'userId'>,
): Promise<ListResult> {
  return cachedListAllCoupons(options);
}

export async function purgeCouponAny(couponId: string): Promise<void> {
  await (storeMode() === 'gas' ? gas.purgeCouponAny(couponId) : demo.purgeCouponAny(couponId));
  invalidate(couponId);
}

const cachedGetSharedCoupon = unstable_cache(
  async (couponId: string): Promise<Coupon> =>
    storeMode() === 'gas' ? gas.getSharedCoupon(couponId) : demo.getSharedCoupon(couponId),
  ['getSharedCoupon'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function getSharedCoupon(couponId: string): Promise<Coupon> {
  return cachedGetSharedCoupon(couponId);
}

const cachedGetCoupon = unstable_cache(
  async (couponId: string, userId: string): Promise<Coupon> =>
    storeMode() === 'gas' ? gas.getCoupon(couponId, userId) : demo.getCoupon(couponId, userId),
  ['getCoupon'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function getCoupon(couponId: string, userId: string): Promise<Coupon> {
  return cachedGetCoupon(couponId, userId);
}

export async function createCoupon(
  userId: string,
  input: CouponInput,
  image?: CouponImageInput,
): Promise<Coupon> {
  const coupon = await (storeMode() === 'gas'
    ? gas.createCoupon(userId, input, image)
    : demo.createCoupon(userId, input, image));
  invalidate(coupon.couponId);
  return coupon;
}

export async function updateCoupon(
  couponId: string,
  userId: string,
  patch: Partial<CouponInput>,
): Promise<Coupon> {
  const coupon = await (storeMode() === 'gas'
    ? gas.updateCoupon(couponId, userId, patch)
    : demo.updateCoupon(couponId, userId, patch));
  invalidate(couponId);
  return coupon;
}

export async function markUsed(couponId: string, userId: string): Promise<Coupon> {
  const coupon = await (storeMode() === 'gas'
    ? gas.markUsed(couponId, userId)
    : demo.markUsed(couponId, userId));
  invalidate(couponId);
  return coupon;
}

export async function undoUsed(couponId: string, userId: string): Promise<Coupon> {
  const coupon = await (storeMode() === 'gas'
    ? gas.undoUsed(couponId, userId)
    : demo.undoUsed(couponId, userId));
  invalidate(couponId);
  return coupon;
}

export async function deleteCoupon(couponId: string, userId: string): Promise<Coupon> {
  const coupon = await (storeMode() === 'gas'
    ? gas.deleteCoupon(couponId, userId)
    : demo.deleteCoupon(couponId, userId));
  invalidate(couponId);
  return coupon;
}

export async function purgeCoupon(couponId: string, userId: string): Promise<void> {
  await (storeMode() === 'gas'
    ? gas.purgeCoupon(couponId, userId)
    : demo.purgeCoupon(couponId, userId));
  invalidate(couponId);
}

const cachedListHistory = unstable_cache(
  async (couponId: string, userId: string): Promise<UsageLog[]> =>
    storeMode() === 'gas' ? gas.listHistory(couponId, userId) : demo.listHistory(couponId, userId),
  ['listHistory'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function listHistory(couponId: string, userId: string): Promise<UsageLog[]> {
  return cachedListHistory(couponId, userId);
}

const cachedGetStats = unstable_cache(
  async (userId: string) =>
    storeMode() === 'gas' ? gas.getStats(userId) : demo.getStats(userId),
  ['getStats'],
  { tags: [LIST_TAG], revalidate: CACHE_SECONDS },
);

export function getStats(userId: string): Promise<{
  total: number;
  unused: number;
  used: number;
  expiring: number;
  expired: number;
}> {
  return cachedGetStats(userId);
}

export function isDemoMode(): boolean {
  return storeMode() === 'demo';
}

export async function readImage(filename: string) {
  if (!isDemoMode()) return null;
  return demo.readDemoImage(filename);
}

/* ------------------------------------------------------------------ */
/* ลิงก์แชร์แบบสั้น (payload เก็บใน Drive / .data)                      */
/* ------------------------------------------------------------------ */

export async function createShare(kind: ShareKind, data: string): Promise<ShareRecord> {
  return await (storeMode() === 'gas' ? gas.createShare(kind, data) : demo.createShare(kind, data));
}

export async function getShare(key: string): Promise<ShareRecord | null> {
  try {
    return await (storeMode() === 'gas' ? gas.getShare(key) : demo.getShare(key));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}
