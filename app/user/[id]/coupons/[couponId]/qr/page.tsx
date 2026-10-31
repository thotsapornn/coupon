import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { FullscreenButton } from '@/components/FullscreenButton';
import { QrTabs } from '@/components/QrTabs';
import { ShareCouponButton } from '@/components/ShareCouponButton';
import { ArrowLeftIcon, CheckCircleIcon, QrIcon } from '@/components/Icons';
import { getCoupon } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { formatThaiDate, getExpiryLabel } from '@/lib/format';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string; couponId: string }> };

export default async function CouponQrPage({ params }: PageProps) {
  const { id, couponId } = await params;
  const actorId = normalizeUserId(id);
  if (!actorId) nextNotFound();

  let coupon;
  try {
    coupon = await getCoupon(couponId, actorId);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') nextNotFound();
    throw error;
  }

  const expiry = getExpiryLabel(coupon);
  const copyValue = coupon.couponCode || coupon.qrRawValue || '';

  return (
    <div className="page">
      <Link href={`/user/${actorId}/coupons/${coupon.couponId}`} className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปรายละเอียดคูปอง
      </Link>

      <div className="qr-shell">
        <div className="qr-card" id="qr-card">
          <span className="qr-brand">Coupon Wallet</span>
          <h1 className="qr-title">{coupon.title}</h1>

          <QrTabs
            coupon={{
              couponCode: coupon.couponCode,
              qrRawValue: coupon.qrRawValue,
              qrType: coupon.qrType,
            }}
          />

          <p className="qr-hint">
            {coupon.expiryDate ? `${expiry.text} · ` : ''}
            เลือกแท็บตามที่ร้านต้องการ
          </p>

          {coupon.status === 'used' ? (
            <span className="badge badge-used">
              <CheckCircleIcon size={12} />
              คูปองนี้ใช้แล้ว
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <ShareCouponButton couponId={coupon.couponId} title={coupon.title} className="btn btn-secondary btn-sm" />
          <FullscreenButton targetId="qr-card" />
          <Link href={`/user/${actorId}/coupons/${coupon.couponId}`} className="btn btn-ghost btn-sm">
            <QrIcon size={14} />
            รายละเอียด
          </Link>
        </div>

        <p className="small muted" style={{ maxWidth: '38ch' }}>
          สร้างจากข้อมูลที่บันทึกไว้ · หากเป็นรหัสใช้ครั้งเดียว ให้ใช้ผ่านแอปของร้าน
        </p>

        {coupon.expiryDate ? (
          <p className="small muted">วันหมดอายุ: {formatThaiDate(coupon.expiryDate)}</p>
        ) : null}

        {copyValue ? (
          <div className="detail-actions" style={{ marginTop: 4 }}>
            <CopyButton value={copyValue} label="คัดลอกรหัส" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
