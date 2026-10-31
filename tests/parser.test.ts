import { describe, expect, it } from 'vitest';
import {
  buildTitle,
  buildTitleFromDescription,
  cleanOcrText,
  detectQrType,
  extractCouponCode,
  extractDiscount,
  extractExpiry,
  normalizeForCompare,
  parseCouponFields,
  sanitizeForSheet,
  stripSpecialChars,
} from '../lib/parser';

describe('detectQrType', () => {
  it('detects urls', () => {
    expect(detectQrType('https://s.shopee.co.th/abc')).toBe('url');
    expect(detectQrType('HTTPS://EXAMPLE.COM')).toBe('url');
  });

  it('detects json', () => {
    expect(detectQrType('{"code":"SAVE50"}')).toBe('json');
    expect(detectQrType('{not json')).toBe('unknown');
  });

  it('detects plain codes', () => {
    expect(detectQrType('SAVE50')).toBe('plain_code');
    expect(detectQrType('GRAB-1FREE')).toBe('plain_code');
  });

  it('handles empty and thai payloads', () => {
    expect(detectQrType('')).toBe('unknown');
    expect(detectQrType('คูปองพิเศษ')).toBe('unknown');
  });
});

describe('extractExpiry', () => {
  it('parses ISO dates', () => {
    expect(extractExpiry('ใช้ได้ถึง 2026-12-31').date).toBe('2026-12-31');
  });

  it('converts buddhist years', () => {
    const result = extractExpiry('หมดอายุ 31 ธ.ค. 2569');
    expect(result.date).toBe('2026-12-31');
    expect(result.buddhist).toBe(true);
  });

  it('rejects impossible dates', () => {
    expect(extractExpiry('31/02/2026').date).toBeUndefined();
  });

  it('treats two-digit years as ambiguous', () => {
    const result = extractExpiry('31/12/69');
    expect(result.date).toBeUndefined();
    expect(result.ambiguous).toBe(true);
  });

  it('accepts a single unambiguous d/m/y date', () => {
    expect(extractExpiry('ใช้ก่อน 5/11/2026').date).toBe('2026-11-05');
  });

  it('is ambiguous when many dates appear without context', () => {
    const result = extractExpiry('วันที่ 01/11/2026 และ 05/11/2026');
    expect(result.date).toBeUndefined();
    expect(result.ambiguous).toBe(true);
  });

  it('prefers the date next to an expiry keyword', () => {
    const result = extractExpiry('ออกวันที่ 01/11/2026 หมดอายุ 31/12/2026');
    expect(result.date).toBe('2026-12-31');
  });
});

describe('extractDiscount', () => {
  it('extracts percent discounts', () => {
    expect(extractDiscount('ส่วนลด 20%')).toBe('ลด 20%');
  });

  it('extracts baht discounts and minimum spend', () => {
    expect(extractDiscount('ลด 50 บาท ขั้นต่ำ 300 บาท')).toBe('ลด 50 บาท ขั้นต่ำ 300 บาท');
  });

  it('extracts buy-one-get-one', () => {
    expect(extractDiscount('โปร 1 แถม 1 เฉพาะเมนู')).toBe('1 แถม 1');
  });

  it('returns minimum spend alone when there is no discount text', () => {
    expect(extractDiscount('ขั้นต่ำ 500 บาท')).toBe('ขั้นต่ำ 500 บาท');
  });

  it('returns undefined when nothing matches', () => {
    expect(extractDiscount('ขอบคุณที่ใช้บริการ')).toBeUndefined();
  });
});

describe('extractCouponCode', () => {
  it('reads labelled codes', () => {
    expect(extractCouponCode('โค้ด: SAVE50')).toBe('SAVE50');
    expect(extractCouponCode('รหัสคูปอง GRAB-1FREE')).toBe('GRAB-1FREE');
    expect(extractCouponCode('promo code: laz20')).toBe('LAZ20');
  });

  it('reads standalone alphanumeric codes', () => {
    expect(extractCouponCode('ส่วนลดพิเศษ\nSAVE50\nใช้ได้ถึง 31/12/2026')).toBe('SAVE50');
  });

  it('does not mistake words without digits for codes', () => {
    expect(extractCouponCode('SHOPEE')).toBeUndefined();
  });
});

describe('auto naming', () => {
  it('combines merchant and discount', () => {
    expect(buildTitle('Shopee', 'ลด 50 บาท')).toBe('Shopee — ลด 50 บาท');
  });

  it('falls back to the creation date and time', () => {
    expect(buildTitle(undefined, undefined, '2026-10-31T14:05:00.000+07:00')).toBe('คูปอง 2026-10-31 14:05');
  });

  it('truncates to 100 characters', () => {
    const title = buildTitle('Merchant', 'x'.repeat(120));
    expect(title.length).toBeLessThanOrEqual(100);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('parseCouponFields', () => {
  it('parses a realistic Thai coupon screenshot text', () => {
    const parsed = parseCouponFields({
      text: [
        'Shopee',
        'ส่วนลด 50 บาท ขั้นต่ำ 300 บาท',
        'โค้ด: SAVE50',
        'ใช้ได้ถึง 31/12/2026',
        'ใช้ได้กับสินค้าทุกหมวด',
      ].join('\n'),
      qrRawValue: 'https://s.shopee.co.th/abc123',
      createdAt: '2026-10-31T14:05:00.000+07:00',
    });

    expect(parsed.title.startsWith('Shopee ส่วนลด 50 บาท ขั้นต่ำ 300 บาท')).toBe(true);
    expect(parsed.title.length).toBeLessThanOrEqual(100);
    expect(parsed.title).not.toMatch(/[—·:/%]/);
    expect(parsed.merchant).toBe('Shopee');
    expect(parsed.couponCode).toBe('SAVE50');
    expect(parsed.expiryDate).toBe('2026-12-31');
    expect(parsed.warnings).toHaveLength(0);
  });

  it('builds the title from OCR description and strips emoji/punctuation', () => {
    const parsed = parseCouponFields({
      text: [
        'Shopee',
        'ส่วนลด 50 บาท ขั้นต่ำ 300 บาท',
        'โค้ด: SAVE50',
        'ใช้ได้ถึง 31/12/2026',
        '✨ โปรพิเศษ 🎉',
      ].join('\n'),
    });

    expect(parsed.title).toBe('Shopee ส่วนลด 50 บาท ขั้นต่ำ 300 บาท โค้ด SAVE50 ใช้ได้ถึง 31 12 2026 โปรพิเศษ');
    expect(parsed.title.length).toBeLessThanOrEqual(100);
    expect(parsed.description).toContain('✨ โปรพิเศษ 🎉');
  });

  it('limits the description to 100 characters', () => {
    const parsed = parseCouponFields({ text: 'A'.repeat(200) });
    expect(parsed.description?.length ?? 0).toBeLessThanOrEqual(100);
  });

  it('warns when there is no text to name the coupon', () => {
    const parsed = parseCouponFields({ text: '' });
    expect(parsed.title).toMatch(/^คูปอง \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  it('uses the cleaned description as the title instead of composing merchant + discount', () => {
    const parsed = parseCouponFields({ text: 'Shopee\nลด 50 บาท\nโค้ด: SAVE50' });
    expect(parsed.title).toBe('Shopee ลด 50 บาท โค้ด SAVE50');
    expect(parsed.title).not.toContain('—');
  });

  it('warns about ambiguous expiry dates', () => {
    const parsed = parseCouponFields({ text: 'ใช้ได้ถึง 31/12/69' });
    expect(parsed.expiryDate).toBeUndefined();
    expect(parsed.warnings.some((warning) => warning.includes('ไม่แน่ใจวันหมดอายุ'))).toBe(true);
  });
});

describe('special character stripping', () => {
  it('keeps Thai, Latin, digits and spaces only', () => {
    expect(stripSpecialChars('✨ Shopee — ลด 50% 🎉 (ขั้นต่ำ 300.-)')).toBe('Shopee ลด 50 ขั้นต่ำ 300');
  });

  it('handles emoji-only text', () => {
    expect(stripSpecialChars('🎉🎉✨')).toBe('');
    expect(buildTitleFromDescription('🎉🎉✨')).toBeUndefined();
  });

  it('truncates at a word boundary within 60 characters', () => {
    const title = buildTitleFromDescription('ส่วนลดพิเศษ '.repeat(10));
    expect(title).toBeDefined();
    expect(title!.length).toBeLessThanOrEqual(100);
    expect(title!.endsWith(' ')).toBe(false);
  });

  it('keeps useful Thai text and numbers', () => {
    expect(stripSpecialChars('ใช้ได้ถึง 31/12/2026')).toBe('ใช้ได้ถึง 31 12 2026');
  });
});

describe('text helpers', () => {
  it('normalises for duplicate comparison without touching stored values', () => {
    expect(normalizeForCompare('  HTTPS://X.CO/ABC/ ')).toBe('https://x.co/abc');
  });

  it('escapes spreadsheet formula prefixes', () => {
    expect(sanitizeForSheet('=IMPORTXML("x")')).toBe("'=IMPORTXML(\"x\")");
    expect(sanitizeForSheet('@user')).toBe("'@user");
    expect(sanitizeForSheet('Shopee')).toBe('Shopee');
  });

  it('cleans control characters and repeated blank lines', () => {
    expect(cleanOcrText('  Shopee  \r\n\r\n\r\nลด 50 บาท  ')).toBe('Shopee\n\nลด 50 บาท');
  });
});
