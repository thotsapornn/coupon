import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  formatDateCompact,
  formatThaiDate,
  getCardExpiryLabel,
  getDisplayStatus,
  getExpiryLabel,
  nowIso,
  todayBangkok,
  truncate,
} from '../lib/format';
import { filterCoupons, matchesStatus, sortCoupons } from '../lib/filter';
import type { Coupon } from '../lib/types';

const NOW = new Date('2026-10-31T05:00:00Z'); // 12:00 น. เวลาไทย

function makeCoupon(overrides: Partial<Coupon>): Coupon {
  return {
    couponId: 'CPN-261031-001',
    userId: 'tar',
    title: 'Test',
    status: 'unused',
    imageStatus: 'ok',
    source: 'upload',
    createdAt: '2026-10-30T10:00:00.000+07:00',
    updatedAt: '2026-10-30T10:00:00.000+07:00',
    ...overrides,
  };
}

describe('Bangkok time helpers', () => {
  it('formats nowIso with millisecond precision and +07:00', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+07:00$/);
  });

  it('resolves today in Bangkok even when UTC is the previous day', () => {
    expect(todayBangkok(new Date('2026-10-30T18:30:00Z'))).toBe('2026-10-31');
  });

  it('counts days until an expiry date', () => {
    expect(daysUntil('2026-11-02', NOW)).toBe(2);
    expect(daysUntil('2026-10-29', NOW)).toBe(-2);
  });

  it('formats Thai dates', () => {
    expect(formatThaiDate('2026-12-31')).toBe('31 ธ.ค. 2026');
    expect(formatThaiDate(undefined)).toBe('ไม่มีวันหมดอายุ');
  });

  it('truncates long text', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });

  it('formats compact dates for coupon cards', () => {
    expect(formatDateCompact('2026-12-31')).toBe('31/12/26');
    expect(formatDateCompact(undefined)).toBe('');
  });
});

describe('card expiry labels', () => {
  it('keeps long Thai dates out of the card', () => {
    expect(getCardExpiryLabel({ status: 'unused', expiryDate: '2026-12-31' }, NOW)).toEqual({
      text: 'ถึง 31/12/26',
      tone: 'neutral',
    });
  });

  it('shows compact expired and expiring labels', () => {
    expect(getCardExpiryLabel({ status: 'unused', expiryDate: '2026-10-30' }, NOW)).toEqual({
      text: 'หมดอายุ 30/10/26',
      tone: 'danger',
    });
    expect(getCardExpiryLabel({ status: 'unused', expiryDate: '2026-11-02' }, NOW)).toEqual({
      text: 'เหลือ 2 วัน',
      tone: 'warn',
    });
  });

  it('handles used and no-expiry coupons', () => {
    expect(getCardExpiryLabel({ status: 'used', expiryDate: '2026-11-02' }, NOW).text).toBe('ใช้แล้ว');
    expect(getCardExpiryLabel({ status: 'unused' }, NOW).text).toBe('ไม่มีวันหมดอายุ');
  });
});

describe('display status', () => {
  it('marks used coupons as used regardless of expiry', () => {
    expect(getDisplayStatus({ status: 'used', expiryDate: '2020-01-01' }, NOW)).toBe('used');
  });

  it('marks past expiry as expired', () => {
    expect(getDisplayStatus({ status: 'unused', expiryDate: '2026-10-30' }, NOW)).toBe('expired');
  });

  it('marks within 3 days as expiring', () => {
    expect(getDisplayStatus({ status: 'unused', expiryDate: '2026-11-02' }, NOW)).toBe('expiring');
    expect(getDisplayStatus({ status: 'unused', expiryDate: '2026-11-03' }, NOW)).toBe('expiring');
  });

  it('keeps coupons without expiry as unused', () => {
    expect(getDisplayStatus({ status: 'unused' }, NOW)).toBe('unused');
  });

  it('produces Thai labels', () => {
    expect(getExpiryLabel({ status: 'unused', expiryDate: '2026-11-02' }, NOW)).toEqual({
      text: 'เหลือ 2 วัน',
      tone: 'warn',
    });
    expect(getExpiryLabel({ status: 'used', expiryDate: '2026-11-02' }, NOW).text).toBe('ใช้แล้ว');
  });
});

describe('filtering and sorting', () => {
  const expired = makeCoupon({ couponId: 'A', expiryDate: '2026-10-01' });
  const expiring = makeCoupon({ couponId: 'B', expiryDate: '2026-11-01' });
  const used = makeCoupon({ couponId: 'C', status: 'used', expiryDate: '2026-11-01', usedAt: '2026-10-30T11:00:00.000+07:00' });
  const noExpiry = makeCoupon({ couponId: 'D' });

  it('filters unused excluding expired', () => {
    const result = filterCoupons([expired, expiring, used, noExpiry], { status: 'unused' }, NOW);
    expect(result.map((c) => c.couponId).sort()).toEqual(['B', 'D']);
  });

  it('filters used and expired', () => {
    expect(filterCoupons([expired, expiring, used], { status: 'used' }, NOW)).toHaveLength(1);
    expect(filterCoupons([expired, expiring, used], { status: 'expired' }, NOW)[0].couponId).toBe('A');
  });

  it('filters expiring within the configured window', () => {
    expect(filterCoupons([expired, expiring], { status: 'expiring' }, NOW)[0].couponId).toBe('B');
  });

  it('searches title, merchant and code case-insensitively', () => {
    const coupon = makeCoupon({ merchant: 'Shopee', couponCode: 'SAVE50' });
    expect(filterCoupons([coupon], { q: 'shop' }, NOW)).toHaveLength(1);
    expect(filterCoupons([coupon], { q: 'save50' }, NOW)).toHaveLength(1);
    expect(filterCoupons([coupon], { q: 'nope' }, NOW)).toHaveLength(0);
  });

  it('sorts expiring first, then unused, expired, used', () => {
    const result = sortCoupons([used, expired, noExpiry, expiring], NOW);
    expect(result.map((c) => c.couponId)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('treats missing status as all', () => {
    expect([expired, used].every((coupon) => matchesStatus(coupon, 'all', NOW))).toBe(true);
  });
});
