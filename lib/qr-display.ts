import type { Coupon } from './types';

export type QrDisplayCoupon = Pick<Coupon, 'couponCode' | 'qrRawValue' | 'qrType'>;

export interface BarcodeInfo {
  value?: string;
  reason?: string;
}

const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;

/** ใช้กับเครื่องมือ /qr: ข้อความทั่วไป -> Code 128 (ASCII, ไม่เกิน 80 ตัว) */
export function getBarcodeForText(text: string, maxLength = 80): BarcodeInfo {
  const value = text.trim();
  if (!value) return { reason: 'ยังไม่มีข้อความ' };
  if (!ASCII_PRINTABLE.test(value)) {
    return { reason: 'บาร์โค้ดรองรับเฉพาะอักษรอังกฤษ ตัวเลข และสัญลักษณ์ ASCII' };
  }
  if (value.length > maxLength) {
    return { reason: `ข้อความยาวเกิน ${maxLength} ตัวอักษรสำหรับบาร์โค้ด` };
  }
  return { value };
}

/** บาร์โค้ด Code 128 รองรับเฉพาะ ASCII ที่พิมพ์ได้ */
export function getBarcodeInfo(coupon: QrDisplayCoupon): BarcodeInfo {
  const code = coupon.couponCode?.trim();
  if (code) {
    if (!ASCII_PRINTABLE.test(code)) {
      return { reason: 'รหัสคูปองมีอักษรไทยหรืออักขระที่บาร์โค้ดไม่รองรับ' };
    }
    if (code.length > 80) {
      return { reason: 'รหัสคูปองยาวเกินไปสำหรับแสดงเป็นบาร์โค้ด' };
    }
    return { value: code };
  }

  const raw = coupon.qrRawValue?.trim();
  if (raw && coupon.qrType === 'plain_code') {
    if (!ASCII_PRINTABLE.test(raw)) {
      return { reason: 'ข้อมูลใน QR มีอักขระที่บาร์โค้ดไม่รองรับ' };
    }
    if (raw.length > 48) {
      return { reason: 'ข้อมูลใน QR ยาวเกินไปสำหรับแสดงเป็นบาร์โค้ด' };
    }
    return { value: raw };
  }

  return { reason: 'คูปองนี้ไม่มีรหัสที่ใช้สร้างบาร์โค้ด — ใช้แท็บ QR หรือเลข QR แทน' };
}

export interface QrDisplayValues extends BarcodeInfo {
  /** ข้อความหลักที่ใช้แสดง/คัดลอก: รหัสคูปองก่อน ถ้าไม่มีใช้ข้อมูลใน QR */
  code?: string;
  /** ข้อมูลดิบใน QR (แสดงเพิ่มเมื่อต่างจาก code) */
  rawValue?: string;
  showRaw: boolean;
}

export function getQrDisplayValues(coupon: QrDisplayCoupon): QrDisplayValues {
  const code = coupon.couponCode?.trim() || coupon.qrRawValue?.trim() || undefined;
  const rawValue = coupon.qrRawValue?.trim() || undefined;
  const barcode = getBarcodeInfo(coupon);

  return {
    ...barcode,
    code,
    rawValue,
    showRaw: Boolean(code && rawValue && code !== rawValue),
  };
}
