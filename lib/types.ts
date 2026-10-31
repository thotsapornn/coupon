export type CouponStatus = 'unused' | 'used';
export type QrType = 'url' | 'plain_code' | 'json' | 'unknown';
export type CouponSource = 'upload' | 'paste' | 'share' | 'manual';
export type ImageStatus = 'ok' | 'pending' | 'missing';

/** สถานะที่ใช้แสดงผล (หมดอายุ/ใกล้หมดอายุ เป็นค่าคำนวณ ไม่ได้เก็บใน status) */
export type DisplayStatus = 'unused' | 'used' | 'expired' | 'expiring';

export interface Coupon {
  couponId: string;
  /** เจ้าของคูปอง — แยกข้อมูลตาม id ที่ผู้ใช้ตั้งเอง */
  userId: string;
  title: string;
  merchant?: string;
  discountText?: string;
  description?: string;
  couponCode?: string;
  qrRawValue?: string;
  qrType?: QrType;
  expiryDate?: string; // YYYY-MM-DD
  status: CouponStatus;
  imageFileId?: string;
  imageUrl?: string;
  imageStatus: ImageStatus;
  ocrTextRaw?: string;
  ocrConfidence?: number;
  note?: string;
  source: CouponSource;
  duplicateOf?: string;
  createdAt: string;
  updatedAt: string;
  usedAt?: string;
  deletedAt?: string;
  notifiedAt?: string;
}

/** ฟิลด์ที่ client ส่งได้ตอนสร้าง/แก้ไข */
export interface CouponInput {
  title: string;
  merchant?: string;
  discountText?: string;
  description?: string;
  couponCode?: string;
  qrRawValue?: string;
  qrType?: QrType;
  expiryDate?: string;
  note?: string;
  source?: CouponSource;
  duplicateOf?: string;
  ocrTextRaw?: string;
  ocrConfidence?: number;
}

export interface CouponImageInput {
  base64: string;
  mimeType: string;
}

export type UsageAction =
  | 'created'
  | 'updated'
  | 'marked_used'
  | 'undo_used'
  | 'deleted'
  | 'restored';

export interface UsageLog {
  logId: string;
  couponId: string;
  action: UsageAction;
  fromStatus?: CouponStatus;
  toStatus?: CouponStatus;
  at: string;
  actor: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export type ListStatusFilter = 'all' | 'unused' | 'used' | 'expired' | 'expiring';

export interface ListCouponsOptions {
  /** ผู้ใช้ที่กำลังดู — เห็นเฉพาะคูปองของ id นี้ */
  userId: string;
  status?: ListStatusFilter;
  q?: string;
  includeDeleted?: boolean;
  limit?: number;
}

export interface ListResult {
  items: Coupon[];
  total: number;
}

export interface ParsedCouponFields {
  title: string;
  merchant?: string;
  discountText?: string;
  couponCode?: string;
  expiryDate?: string;
  description?: string;
  warnings: string[];
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: Array<{ text: string; confidence: number }>;
}

export interface QrScanResult {
  rawValue: string;
  type: QrType;
  engine: 'jsqr' | 'zxing';
  ms: number;
}
