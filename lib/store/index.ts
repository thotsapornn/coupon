import * as demo from './demo';
import * as gas from './gas';
import type { Coupon, CouponImageInput, CouponInput, ListCouponsOptions, ListResult, UsageLog } from '../types';

export type StoreMode = 'demo' | 'gas';

export function storeMode(): StoreMode {
  return gas.isGasConfigured() ? 'gas' : 'demo';
}

export function listCoupons(options: ListCouponsOptions): Promise<ListResult> {
  return storeMode() === 'gas' ? gas.listCoupons(options) : demo.listCoupons(options);
}

export function getSharedCoupon(couponId: string): Promise<Coupon> {
  return storeMode() === 'gas' ? gas.getSharedCoupon(couponId) : demo.getSharedCoupon(couponId);
}

export function getCoupon(couponId: string, userId: string): Promise<Coupon> {
  return storeMode() === 'gas' ? gas.getCoupon(couponId, userId) : demo.getCoupon(couponId, userId);
}

export function createCoupon(
  userId: string,
  input: CouponInput,
  image?: CouponImageInput,
): Promise<Coupon> {
  return storeMode() === 'gas'
    ? gas.createCoupon(userId, input, image)
    : demo.createCoupon(userId, input, image);
}

export function updateCoupon(
  couponId: string,
  userId: string,
  patch: Partial<CouponInput>,
): Promise<Coupon> {
  return storeMode() === 'gas'
    ? gas.updateCoupon(couponId, userId, patch)
    : demo.updateCoupon(couponId, userId, patch);
}

export function markUsed(couponId: string, userId: string): Promise<Coupon> {
  return storeMode() === 'gas' ? gas.markUsed(couponId, userId) : demo.markUsed(couponId, userId);
}

export function undoUsed(couponId: string, userId: string): Promise<Coupon> {
  return storeMode() === 'gas' ? gas.undoUsed(couponId, userId) : demo.undoUsed(couponId, userId);
}

export function deleteCoupon(couponId: string, userId: string): Promise<Coupon> {
  return storeMode() === 'gas'
    ? gas.deleteCoupon(couponId, userId)
    : demo.deleteCoupon(couponId, userId);
}

export function purgeCoupon(couponId: string, userId: string): Promise<void> {
  return storeMode() === 'gas'
    ? gas.purgeCoupon(couponId, userId)
    : demo.purgeCoupon(couponId, userId);
}

export function listHistory(couponId: string, userId: string): Promise<UsageLog[]> {
  return storeMode() === 'gas'
    ? gas.listHistory(couponId, userId)
    : demo.listHistory(couponId, userId);
}

export function getStats(userId: string): Promise<{
  total: number;
  unused: number;
  used: number;
  expiring: number;
  expired: number;
}> {
  return storeMode() === 'gas' ? gas.getStats(userId) : demo.getStats(userId);
}

export function isDemoMode(): boolean {
  return storeMode() === 'demo';
}

export async function readImage(filename: string) {
  if (!isDemoMode()) return null;
  return demo.readDemoImage(filename);
}
