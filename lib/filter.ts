import { daysUntil, nearExpiryDays } from './format';
import type { Coupon, ListStatusFilter } from './types';

export function matchesStatus(
  coupon: Coupon,
  status: ListStatusFilter | undefined,
  now = new Date(),
): boolean {
  if (!status || status === 'all') return true;
  if (status === 'used') return coupon.status === 'used';
  if (coupon.status === 'used') return false;

  const days = coupon.expiryDate ? daysUntil(coupon.expiryDate, now) : Number.NaN;
  if (status === 'unused') return !coupon.expiryDate || Number.isNaN(days) || days >= 0;
  if (status === 'expired') return Boolean(coupon.expiryDate) && days < 0;
  if (status === 'expiring') {
    return Boolean(coupon.expiryDate) && days >= 0 && days <= nearExpiryDays();
  }
  return true;
}

export function matchesQuery(coupon: Coupon, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [coupon.title, coupon.merchant, coupon.couponCode, coupon.discountText, coupon.description, coupon.userId]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

export function filterCoupons(
  coupons: Coupon[],
  options: { status?: ListStatusFilter; q?: string },
  now = new Date(),
): Coupon[] {
  const active = coupons.filter((coupon) => !coupon.deletedAt);
  return active
    .filter((coupon) => matchesStatus(coupon, options.status, now))
    .filter((coupon) => matchesQuery(coupon, options.q ?? ''));
}

function rankOf(coupon: Coupon, now: Date): number {
  if (coupon.status === 'used') return 3;
  if (!coupon.expiryDate) return 1;
  const days = daysUntil(coupon.expiryDate, now);
  if (days < 0) return 2;
  return days <= nearExpiryDays() ? 0 : 1;
}

export function sortCoupons(coupons: Coupon[], now = new Date()): Coupon[] {
  return [...coupons].sort((a, b) => {
    const rankDiff = rankOf(a, now) - rankOf(b, now);
    if (rankDiff !== 0) return rankDiff;

    if (a.status === 'used' && b.status === 'used') {
      return (b.usedAt ?? b.updatedAt).localeCompare(a.usedAt ?? a.updatedAt);
    }
    if (a.expiryDate && b.expiryDate) {
      const diff = a.expiryDate.localeCompare(b.expiryDate);
      if (diff !== 0) return diff;
    } else if (a.expiryDate !== b.expiryDate) {
      return a.expiryDate ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
