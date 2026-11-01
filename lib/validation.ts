import { z } from 'zod';
import { MAX_SHARE_CHARS } from './lottery';
import { validationError } from './errors';

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .max(max, `${label}ต้องไม่เกิน ${max} ตัวอักษร`)
      .optional(),
  );

const expirySchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันหมดอายุต้องอยู่ในรูปแบบ YYYY-MM-DD')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, 'วันหมดอายุไม่ถูกต้อง')
    .optional(),
);

export const couponWriteSchema = z.object({
  title: z
    .string({ error: 'กรุณากรอกชื่อคูปอง' })
    .trim()
    .min(1, 'กรุณากรอกชื่อคูปอง')
    .max(100, 'ชื่อคูปองต้องไม่เกิน 100 ตัวอักษร'),
  merchant: optionalText(50, 'ชื่อร้าน'),
  discountText: optionalText(80, 'รายละเอียดส่วนลด'),
  description: optionalText(100, 'รายละเอียด'),
  couponCode: optionalText(100, 'รหัสคูปอง'),
  qrRawValue: optionalText(2000, 'ข้อมูล QR'),
  qrType: z.enum(['url', 'plain_code', 'json', 'unknown']).optional(),
  expiryDate: expirySchema,
  note: optionalText(300, 'บันทึกช่วยจำ'),
  source: z.enum(['upload', 'paste', 'share', 'manual']).optional(),
  duplicateOf: optionalText(40, 'คูปองที่ซ้ำ'),
  ocrTextRaw: optionalText(5000, 'ข้อความ OCR'),
  ocrConfidence: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().min(0).max(100).optional(),
  ),
});

export const createCouponSchema = couponWriteSchema.extend({
  userId: z
    .string({ error: 'ต้องระบุ userId' })
    .trim()
    .min(1, 'ต้องระบุ userId')
    .max(30, 'userId ยาวเกินไป'),
  imageBase64: z
    .string({ error: 'ไม่พบรูปภาพ' })
    .min(1, 'ไม่พบรูปภาพ')
    .max(2_800_000, 'รูปภาพมีขนาดใหญ่เกินไป (เกิน 2 MB)'),
  imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    error: 'รองรับเฉพาะ JPG, PNG และ WEBP',
  }),
});

export const updateCouponSchema = couponWriteSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'ไม่มีข้อมูลที่ต้องการแก้ไข',
);

export const shareCreateSchema = z.object({
  kind: z.enum(['full', 'summary'], { error: 'ชนิดลิงก์แชร์ไม่ถูกต้อง' }),
  data: z
    .string({ error: 'ไม่พบข้อมูลที่ต้องการแชร์' })
    .min(1, 'ไม่พบข้อมูลที่ต้องการแชร์')
    .max(MAX_SHARE_CHARS, 'ข้อมูลแชร์ยาวเกินไป')
    .regex(/^[A-Za-z0-9+/_=-]+$/, 'ข้อมูลแชร์ไม่ถูกต้อง'),
});

export type CouponWriteValues = z.infer<typeof couponWriteSchema>;
export type CreateCouponValues = z.infer<typeof createCouponSchema>;
export type UpdateCouponValues = z.infer<typeof updateCouponSchema>;
export type ShareCreateValues = z.infer<typeof shareCreateSchema>;

export function parseWithSchema<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = result.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
  throw validationError(first, fields);
}
