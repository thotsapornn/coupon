import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/errors';
import { couponWriteSchema, createCouponSchema, parseWithSchema, updateCouponSchema } from '../lib/validation';

const validCreate = {
  userId: 'tar',
  title: 'Shopee — ลด 50 บาท',
  merchant: 'Shopee',
  couponCode: 'SAVE50',
  expiryDate: '2026-12-31',
  imageBase64: 'aGVsbG8=',
  imageMimeType: 'image/png',
};

describe('createCouponSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = createCouponSchema.parse(validCreate);
    expect(parsed.title).toBe('Shopee — ลด 50 บาท');
    expect(parsed.source).toBeUndefined();
  });

  it('trims text fields', () => {
    const parsed = createCouponSchema.parse({ ...validCreate, title: '  Test  ' });
    expect(parsed.title).toBe('Test');
  });

  it('rejects an empty title', () => {
    const result = createCouponSchema.safeParse({ ...validCreate, title: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a title longer than 100 characters', () => {
    const result = createCouponSchema.safeParse({ ...validCreate, title: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('converts empty optional strings to undefined', () => {
    const parsed = createCouponSchema.parse({ ...validCreate, merchant: '', couponCode: '  ' });
    expect(parsed.merchant).toBeUndefined();
    expect(parsed.couponCode).toBeUndefined();
  });

  it('rejects invalid expiry dates', () => {
    expect(createCouponSchema.safeParse({ ...validCreate, expiryDate: '31/12/2026' }).success).toBe(false);
    expect(createCouponSchema.safeParse({ ...validCreate, expiryDate: '2026-02-31' }).success).toBe(false);
  });

  it('enforces the image mime whitelist', () => {
    expect(
      createCouponSchema.safeParse({ ...validCreate, imageMimeType: 'image/gif' }).success,
    ).toBe(false);
  });

  it('requires an image', () => {
    const { imageBase64: _ignored, ...withoutImage } = validCreate;
    expect(createCouponSchema.safeParse(withoutImage).success).toBe(false);
  });

  it('limits the description to 100 characters', () => {
    expect(createCouponSchema.safeParse({ ...validCreate, description: 'x'.repeat(100) }).success).toBe(true);
    expect(createCouponSchema.safeParse({ ...validCreate, description: 'x'.repeat(101) }).success).toBe(false);
  });

  it('requires a userId', () => {
    const { userId: _ignored, ...withoutUser } = validCreate;
    expect(createCouponSchema.safeParse(withoutUser).success).toBe(false);
  });
});

describe('couponWriteSchema', () => {
  it('accepts a coupon without optional fields', () => {
    const parsed = couponWriteSchema.parse({ title: 'คูปอง' });
    expect(parsed.expiryDate).toBeUndefined();
  });

  it('clamps confidence to 0-100', () => {
    expect(couponWriteSchema.safeParse({ title: 'x', ocrConfidence: 101 }).success).toBe(false);
    expect(couponWriteSchema.safeParse({ title: 'x', ocrConfidence: 88.5 }).success).toBe(true);
  });
});

describe('updateCouponSchema', () => {
  it('accepts a partial patch', () => {
    expect(updateCouponSchema.parse({ title: 'ใหม่' })).toEqual({ title: 'ใหม่' });
  });

  it('rejects an empty patch', () => {
    expect(updateCouponSchema.safeParse({}).success).toBe(false);
  });
});

describe('parseWithSchema', () => {
  it('throws ApiError with field-level messages', () => {
    try {
      parseWithSchema(createCouponSchema, { ...validCreate, title: '' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('VALIDATION_ERROR');
      expect(apiError.fields?.title).toBeTruthy();
    }
  });
});
