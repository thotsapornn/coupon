'use client';

import type { Coupon } from '@/lib/types';

export interface CouponFormState {
  title: string;
  merchant: string;
  discountText: string;
  couponCode: string;
  expiryDate: string;
  description: string;
  note: string;
  qrRawValue: string;
}

export const emptyCouponForm: CouponFormState = {
  title: '',
  merchant: '',
  discountText: '',
  couponCode: '',
  expiryDate: '',
  description: '',
  note: '',
  qrRawValue: '',
};

export function formFromCoupon(coupon: Coupon): CouponFormState {
  return {
    title: coupon.title ?? '',
    merchant: coupon.merchant ?? '',
    discountText: coupon.discountText ?? '',
    couponCode: coupon.couponCode ?? '',
    expiryDate: coupon.expiryDate ?? '',
    description: coupon.description ?? '',
    note: coupon.note ?? '',
    qrRawValue: coupon.qrRawValue ?? '',
  };
}

export interface CouponFieldsProps {
  values: CouponFormState;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (field: keyof CouponFormState, value: string) => void;
}

export function CouponFields({ values, errors, disabled, onChange }: CouponFieldsProps) {
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor="coupon-title">
          ชื่อคูปอง <span className="optional">จำเป็น</span>
        </label>
        <input
          id="coupon-title"
          value={values.title}
          onChange={(event) => onChange('title', event.target.value)}
          maxLength={100}
          disabled={disabled}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'coupon-title-error' : 'coupon-title-hint'}
          placeholder="เช่น Shopee — ลด 50 บาท"
          autoComplete="off"
        />
        {errors.title ? (
          <p className="field-error" id="coupon-title-error">
            {errors.title}
          </p>
        ) : (
          <p className="field-hint" id="coupon-title-hint">
            ระบบตั้งชื่อให้จาก OCR แล้ว — แก้ได้ตามต้องการ (ไม่เกิน 100 ตัวอักษร)
          </p>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="coupon-merchant">
            ร้านค้า <span className="optional">ไม่บังคับ</span>
          </label>
          <input
            id="coupon-merchant"
            value={values.merchant}
            onChange={(event) => onChange('merchant', event.target.value)}
            maxLength={50}
            disabled={disabled}
            placeholder="Shopee, Grab, Starbucks…"
            autoComplete="off"
          />
          {errors.merchant ? <p className="field-error">{errors.merchant}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="coupon-discount">
            ส่วนลด / เงื่อนไข <span className="optional">ไม่บังคับ</span>
          </label>
          <input
            id="coupon-discount"
            value={values.discountText}
            onChange={(event) => onChange('discountText', event.target.value)}
            maxLength={80}
            disabled={disabled}
            placeholder="ลด 50 บาท ขั้นต่ำ 300"
            autoComplete="off"
          />
          {errors.discountText ? <p className="field-error">{errors.discountText}</p> : null}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="coupon-expiry">
            วันหมดอายุ <span className="optional">ไม่บังคับ</span>
          </label>
          <input
            id="coupon-expiry"
            type="date"
            value={values.expiryDate}
            onChange={(event) => onChange('expiryDate', event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.expiryDate)}
          />
          {errors.expiryDate ? (
            <p className="field-error">{errors.expiryDate}</p>
          ) : (
            <p className="field-hint">ใช้ปี ค.ศ. — ระบบแปลง พ.ศ. ให้แล้ว</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="coupon-code">
            รหัสคูปอง <span className="optional">ไม่บังคับ</span>
          </label>
          <input
            id="coupon-code"
            value={values.couponCode}
            onChange={(event) => onChange('couponCode', event.target.value.toUpperCase())}
            maxLength={100}
            disabled={disabled}
            placeholder="SAVE50"
            autoComplete="off"
            spellCheck={false}
            style={{ fontFamily: 'var(--mono)' }}
          />
          {errors.couponCode ? <p className="field-error">{errors.couponCode}</p> : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="coupon-description">
          รายละเอียด <span className="optional">ไม่บังคับ</span>
        </label>
        <textarea
          id="coupon-description"
          value={values.description}
          onChange={(event) => onChange('description', event.target.value)}
          maxLength={100}
          rows={3}
          disabled={disabled}
          placeholder="เงื่อนไขการใช้งาน ระยะเวลา หรือข้อจำกัด"
        />
        {errors.description ? <p className="field-error">{errors.description}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="coupon-note">
          บันทึกช่วยจำ <span className="optional">ไม่บังคับ</span>
        </label>
        <textarea
          id="coupon-note"
          value={values.note}
          onChange={(event) => onChange('note', event.target.value)}
          maxLength={300}
          rows={2}
          disabled={disabled}
          placeholder="เช่น ใช้กับบิลนี้เท่านั้น / ต้องแสดงหน้าร้าน"
        />
        {errors.note ? <p className="field-error">{errors.note}</p> : null}
      </div>

      <details className="ocr-details">
        <summary>ข้อมูล QR Code (ขั้นสูง)</summary>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="coupon-qr">
            ข้อความจาก QR <span className="optional">แก้เฉพาะเมื่ออ่านผิด</span>
          </label>
          <textarea
            id="coupon-qr"
            value={values.qrRawValue}
            onChange={(event) => onChange('qrRawValue', event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={disabled}
            spellCheck={false}
            style={{ fontFamily: 'var(--mono)' }}
            placeholder="https://… หรือรหัสคูปอง"
          />
          {errors.qrRawValue ? <p className="field-error">{errors.qrRawValue}</p> : null}
          <p className="field-hint">
            QR ในหน้าใช้งานจะถูกวาดใหม่จากข้อความนี้ — หากแก้ ระบบจะเตือนว่าไม่ใช่ QR ต้นฉบับ
          </p>
        </div>
      </details>
    </div>
  );
}
