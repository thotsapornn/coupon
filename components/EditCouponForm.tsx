'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Coupon } from '@/lib/types';
import { detectQrType } from '@/lib/parser';
import { CouponFields, formFromCoupon, type CouponFormState } from './CouponFields';
import { ConfirmDialog } from './ConfirmDialog';
import { AlertIcon, CheckCircleIcon, InfoIcon } from './Icons';

export function EditCouponForm({ coupon, actorId }: { coupon: Coupon; actorId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<CouponFormState>(() => formFromCoupon(coupon));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmQr, setConfirmQr] = useState(false);

  const qrChanged = form.qrRawValue.trim() !== (coupon.qrRawValue ?? '').trim();

  function updateField(field: keyof CouponFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'กรุณากรอกชื่อคูปอง';
    if (form.title.trim().length > 100) next.title = 'ชื่อคูปองต้องไม่เกิน 100 ตัวอักษร';
    if (form.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiryDate)) {
      next.expiryDate = 'วันหมดอายุไม่ถูกต้อง';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/coupons/${coupon.couponId}?userId=${encodeURIComponent(actorId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          qrType: qrChanged ? detectQrType(form.qrRawValue) : coupon.qrType,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !payload.ok) {
        if (payload.error?.fields) setErrors(payload.error.fields);
        throw new Error(payload.error?.message ?? 'บันทึกการแก้ไขไม่สำเร็จ');
      }

      router.push(`/user/${actorId}/coupons/${coupon.couponId}?updated=1`);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setSaving(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    if (qrChanged) {
      setConfirmQr(true);
      return;
    }
    void submit();
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? (
        <p className="notice notice-error" role="alert" style={{ marginBottom: 16 }}>
          <AlertIcon size={16} />
          {error}
        </p>
      ) : null}

      <div className="panel">
        <div className="notice notice-info" style={{ marginBottom: 18 }}>
          <InfoIcon size={16} />
          <span>
            แก้ได้เฉพาะข้อมูลคูปอง — รหัสคูปอง (ID), วันที่เพิ่ม และสถานะเปลี่ยนผ่านปุ่ม “ใช้แล้ว” เท่านั้น
          </span>
        </div>

        {qrChanged ? (
          <p className="notice notice-warn" style={{ marginBottom: 18 }}>
            <AlertIcon size={16} />
            คุณกำลังแก้ข้อมูล QR — QR ที่แสดงในหน้าใช้งานจะถูกวาดใหม่ และอาจไม่ใช่ QR ต้นฉบับของร้าน
          </p>
        ) : null}

        <CouponFields values={form} errors={errors} disabled={saving} onChange={updateField} />

        <div className="form-actions" style={{ marginTop: 22 }}>
          <Link href={`/user/${actorId}/coupons/${coupon.couponId}`} className="btn btn-ghost">
            ยกเลิก
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : (
              <>
                <CheckCircleIcon size={16} />
                บันทึกการแก้ไข
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmQr}
        title="ยืนยันแก้ข้อมูล QR?"
        text="การเปลี่ยนข้อความ QR จะทำให้หน้าใช้งานสร้าง QR ใหม่จากข้อความนี้ ซึ่งอาจใช้สแกนกับร้านไม่ได้หาก QR ต้นฉบับเป็นแบบ dynamic"
        confirmLabel="ยืนยันและบันทึก"
        busy={saving}
        onConfirm={() => {
          setConfirmQr(false);
          void submit();
        }}
        onCancel={() => setConfirmQr(false)}
      />
    </form>
  );
}
