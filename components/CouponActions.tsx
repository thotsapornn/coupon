'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Coupon } from '@/lib/types';
import { getDisplayStatus } from '@/lib/format';
import { ConfirmDialog } from './ConfirmDialog';
import { ShareCouponButton } from './ShareCouponButton';
import { CheckIcon, PencilIcon, QrIcon, TrashIcon, UndoIcon } from './Icons';
import Link from 'next/link';

type Action = 'use' | 'undo' | 'delete';

export function CouponActions({
  coupon,
  actorId,
  qrHref,
}: {
  coupon: Coupon;
  actorId: string;
  qrHref?: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isExpired = getDisplayStatus(coupon) === 'expired';

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function run() {
    if (!action) return;
    setBusy(true);
    setError(null);

    try {
      const base = `/api/coupons/${coupon.couponId}`;
      const endpoint =
        action === 'use'
          ? `${base}/use?userId=${encodeURIComponent(actorId)}`
          : action === 'undo'
            ? `${base}/undo-use?userId=${encodeURIComponent(actorId)}`
            : `${base}?userId=${encodeURIComponent(actorId)}`;

      const response = await fetch(endpoint, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers:
          action === 'delete'
            ? undefined
            : { 'Idempotency-Key': crypto.randomUUID() },
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? 'ดำเนินการไม่สำเร็จ');
      }

      setAction(null);
      if (action === 'delete') {
        router.push(`/user/${actorId}`);
        router.refresh();
        return;
      }

      setNotice(action === 'use' ? 'บันทึกว่าใช้คูปองแล้ว' : 'เปลี่ยนกลับเป็นยังไม่ใช้แล้ว');
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      ) : null}

      <div className="detail-actions">
        <div className="detail-primary-row">
          {coupon.status === 'unused' ? (
            <button type="button" className="btn btn-success" onClick={() => setAction('use')}>
              <CheckIcon size={16} />
              ใช้คูปองแล้ว
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-soft-green"
              onClick={() => setAction('undo')}
              aria-label="ย้อนกลับเป็นยังไม่ใช้"
            >
              <UndoIcon size={16} />
              ย้อนกลับ
            </button>
          )}

          {qrHref ? (
            <Link
              href={qrHref}
              className="btn btn-primary"
              aria-label="เปิด QR Code สำหรับใช้ที่ร้าน"
            >
              <QrIcon size={16} />
              เปิด QR
            </Link>
          ) : null}
        </div>

        <div className="detail-action-row">
          <ShareCouponButton
            couponId={coupon.couponId}
            title={coupon.title}
            label="คัดลอกลิงก์"
            copyOnly
            className="btn btn-secondary"
          />
          <Link href={`/user/${actorId}/coupons/${coupon.couponId}/edit`} className="btn btn-secondary">
            <PencilIcon size={16} />
            แก้ไข
          </Link>
        </div>

        <div className="detail-action-row is-danger">
          <button type="button" className="btn btn-danger-ghost" onClick={() => setAction('delete')}>
            <TrashIcon size={16} />
            ลบคูปองนี้
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={action === 'use'}
        title="ยืนยันใช้คูปองนี้?"
        text={
          isExpired
            ? 'คูปองนี้หมดอายุแล้ว หากยังต้องการบันทึกว่าใช้แล้ว กรุณายืนยันอีกครั้ง'
            : 'ระบบจะบันทึกวันและเวลาที่ใช้ และย้ายคูปองไปหมวด “ใช้แล้ว”'
        }
        confirmLabel={isExpired ? 'ยืนยันใช้คูปองที่หมดอายุ' : 'ยืนยันใช้คูปอง'}
        tone={isExpired ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={run}
        onCancel={() => setAction(null)}
      />

      <ConfirmDialog
        open={action === 'undo'}
        title="ย้อนกลับเป็นยังไม่ใช้?"
        text="สถานะจะกลับเป็น “ยังไม่ใช้” และเวลาที่ใช้จะถูกล้าง แต่ประวัติการใช้งานเดิมจะยังถูกเก็บไว้"
        confirmLabel="ย้อนกลับ"
        busy={busy}
        onConfirm={run}
        onCancel={() => setAction(null)}
      />

      <ConfirmDialog
        open={action === 'delete'}
        title="ลบคูปองนี้ออกจากรายการ?"
        text="คูปองจะถูกซ่อนจากรายการ (soft delete) แต่แถวข้อมูลและรูปต้นฉบับใน Google Drive จะยังอยู่"
        confirmLabel="ลบคูปอง"
        tone="danger"
        busy={busy}
        onConfirm={run}
        onCancel={() => setAction(null)}
      />
    </>
  );
}
