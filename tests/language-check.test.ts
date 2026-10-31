import { describe, expect, it } from 'vitest';
import { checkTextLanguage } from '../lib/language-check';

describe('language check', () => {
  it('accepts clean coupon text', () => {
    const result = checkTextLanguage('Shopee ลด 50 บาท ขั้นต่ำ 300 บาท', { ocrConfidence: 90 });
    expect(result.score).toBe(100);
    expect(result.tokens).toHaveLength(0);
    expect(result.level).toBe('good');
  });

  it('accepts seed-style Thai descriptions', () => {
    const result = checkTextLanguage('ใช้ได้กับสินค้าทุกหมวด ไม่รวมสินค้าในหมวดสุขภาพ');
    expect(result.tokens).toHaveLength(0);
  });

  it('flags repeated characters', () => {
    const result = checkTextLanguage('ลดดด 50 บาท');
    expect(result.score).toBeLessThan(100);
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it('ignores URLs, codes and numbers', () => {
    const result = checkTextLanguage('SAVE50 https://example.com 300 บาท');
    expect(result.tokens).toHaveLength(0);
  });

  it('normalizes Thai digits', () => {
    const result = checkTextLanguage('ลด ๕๐ บาท');
    expect(result.tokens).toHaveLength(0);
  });

  it('lowers the score when OCR confidence is low', () => {
    const high = checkTextLanguage('ลด 50 บาท', { ocrConfidence: 90 });
    const low = checkTextLanguage('ลด 50 บาท', { ocrConfidence: 50 });
    expect(low.score).toBe(high.score - 10);
    expect(low.notes).toContain('OCR confidence ต่ำ');
  });

  it('returns a poor result for empty text', () => {
    const result = checkTextLanguage('   ');
    expect(result.score).toBe(0);
    expect(result.label).toBe('ไม่มีข้อความ');
  });

  it('flags Thai words that are not in the dictionary', () => {
    const result = checkTextLanguage('อะลุ่มอล่วย');
    expect(result.tokens.length).toBeGreaterThan(0);
  });
});
