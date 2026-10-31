import { describe, expect, it } from 'vitest';
import { getBarcodeForText, getBarcodeInfo, getQrDisplayValues } from '../lib/qr-display';

describe('QR display values', () => {
  it('uses the coupon code as the primary value', () => {
    const values = getQrDisplayValues({
      couponCode: 'SAVE50',
      qrRawValue: 'https://s.shopee.co.th/abc',
      qrType: 'url',
    });
    expect(values.code).toBe('SAVE50');
    expect(values.rawValue).toBe('https://s.shopee.co.th/abc');
    expect(values.showRaw).toBe(true);
  });

  it('falls back to the raw QR value when there is no coupon code', () => {
    const values = getQrDisplayValues({
      qrRawValue: 'https://s.shopee.co.th/abc',
      qrType: 'url',
    });
    expect(values.code).toBe('https://s.shopee.co.th/abc');
    expect(values.showRaw).toBe(false);
  });

  it('returns an empty state when there is no code at all', () => {
    expect(getQrDisplayValues({}).code).toBeUndefined();
  });
});

describe('barcode values', () => {
  it('encodes an ASCII coupon code', () => {
    expect(getBarcodeInfo({ couponCode: 'SAVE50', qrType: 'url' }).value).toBe('SAVE50');
  });

  it('uses a plain-code QR payload when there is no coupon code', () => {
    expect(getBarcodeInfo({ qrRawValue: 'GRAB1FREE', qrType: 'plain_code' }).value).toBe('GRAB1FREE');
  });

  it('refuses to render a barcode from a URL', () => {
    const info = getBarcodeInfo({ qrRawValue: 'https://example.com/abc', qrType: 'url' });
    expect(info.value).toBeUndefined();
    expect(info.reason).toContain('ไม่มีรหัส');
  });

  it('refuses to render Thai characters as a barcode', () => {
    const info = getBarcodeInfo({ couponCode: 'คูปอง50' });
    expect(info.value).toBeUndefined();
    expect(info.reason).toContain('อักษรไทย');
  });

  it('refuses codes longer than 80 characters', () => {
    const info = getBarcodeInfo({ couponCode: 'A'.repeat(81) });
    expect(info.value).toBeUndefined();
    expect(info.reason).toContain('ยาวเกินไป');
  });

  it('refuses long plain-code payloads', () => {
    const info = getBarcodeInfo({ qrRawValue: 'X'.repeat(49), qrType: 'plain_code' });
    expect(info.value).toBeUndefined();
  });
});


describe('barcode from arbitrary text', () => {
  it('encodes ASCII text', () => {
    expect(getBarcodeForText('HELLO-2026').value).toBe('HELLO-2026');
  });

  it('rejects Thai text with a reason', () => {
    const info = getBarcodeForText('สวัสดี');
    expect(info.value).toBeUndefined();
    expect(info.reason).toContain('ASCII');
  });

  it('rejects text longer than the limit', () => {
    const info = getBarcodeForText('A'.repeat(81));
    expect(info.value).toBeUndefined();
    expect(info.reason).toContain('80');
  });

  it('reports empty text', () => {
    expect(getBarcodeForText('   ').reason).toContain('ยังไม่มี');
  });

  it('trims surrounding whitespace', () => {
    expect(getBarcodeForText('  CODE  ').value).toBe('CODE');
  });
});
