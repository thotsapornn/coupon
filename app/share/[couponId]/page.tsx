import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { ArrowLeftIcon, ClockIcon, QrIcon } from '@/components/Icons';
import { CopyButton } from '@/components/CopyButton';
import { CouponImage } from '@/components/CouponImage';
import { QrTabs } from '@/components/QrTabs';
import { ShareCouponButton } from '@/components/ShareCouponButton';
import { StatusBadge } from '@/components/StatusBadge';
import { getSharedCoupon } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { formatDateTime, formatThaiDate, getExpiryLabel } from '@/lib/format';
import { toDisplayImageUrl } from '@/lib/image-url';
import { BackLink } from '@/components/BackLink';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ couponId: string }> };

export async function generateMetadata({ params }: PageProps) {
  try {
    const { couponId } = await params;
    const coupon = await getSharedCoupon(couponId);
    return { title: coupon.title, description: 'คูปองที่แชร์ · อ่านอย่างเดียว' };
  } catch {
    return { title: 'ไม่พบคูปอง' };
  }
}

export default async function SharedCouponPage({ params }: PageProps) {
  const { couponId } = await params;

  let coupon;
  try {
    coupon = await getSharedCoupon(couponId);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') nextNotFound();
    throw error;
  }

  const expiry = getExpiryLabel(coupon);
  const hasCode = Boolean(coupon.qrRawValue || coupon.couponCode);

  return (
    <div className="page page-narrow">
      <BackLink fallback="/">
        กลับหน้าแรก
      </BackLink>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="detail-top">
          <div className="detail-sub">
            <span className="coupon-merchant">{coupon.merchant ?? 'คูปอง'}</span>
            <StatusBadge coupon={coupon} />
          </div>
          <h1 className="detail-title">{coupon.title}</h1>
          {coupon.discountText ? <p className="coupon-discount">{coupon.discountText}</p> : null}
          <div className="detail-sub">
            <span className={`coupon-expiry tone-${expiry.tone}`}>
              <ClockIcon size={14} />
              {expiry.text}
            </span>
            {coupon.status === 'used' && coupon.usedAt ? (
              <span>· ใช้เมื่อ {formatDateTime(coupon.usedAt)}</span>
            ) : null}
          </div>
        </div>

        {coupon.couponCode ? (
          <div className="code-box">
            <div>
              <p className="meta-label">รหัสคูปอง</p>
              <p className="code-value">{coupon.couponCode}</p>
            </div>
            <CopyButton value={coupon.couponCode} label="คัดลอก" />
          </div>
        ) : null}

        {hasCode ? (
          <QrTabs
            coupon={{
              couponCode: coupon.couponCode,
              qrRawValue: coupon.qrRawValue,
              qrType: coupon.qrType,
            }}
          />
        ) : (
          <p className="notice notice-info">
            <QrIcon size={16} />
            คูปองนี้ไม่มี QR Code หรือรหัสคูปอง
          </p>
        )}

        <div className="detail-actions" style={{ justifyContent: 'center' }}>
          <ShareCouponButton
            couponId={coupon.couponId}
            title={coupon.title}
            label="คัดลอกลิงก์"
            copyOnly
          />
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">สถานะ</span>
            <span className="meta-value">{coupon.status === 'used' ? 'ใช้แล้ว' : 'ยังไม่ใช้'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">วันหมดอายุ</span>
            <span className="meta-value">
              {coupon.expiryDate ? formatThaiDate(coupon.expiryDate) : 'ไม่มี'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">วันที่ใช้</span>
            <span className="meta-value">{coupon.usedAt ? formatDateTime(coupon.usedAt) : '—'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">เพิ่มเมื่อ</span>
            <span className="meta-value">{formatDateTime(coupon.createdAt)}</span>
          </div>
        </div>

        {coupon.description ? (
          <div>
            <p className="meta-label">รายละเอียด</p>
            <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
              {coupon.description}
            </p>
          </div>
        ) : null}

        {coupon.note ? (
          <div>
            <p className="meta-label">บันทึก</p>
            <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
              {coupon.note}
            </p>
          </div>
        ) : null}

        <p className="notice notice-warn">
          ลิงก์นี้เป็นแบบอ่านอย่างเดียว — ใครมีลิงก์สามารถเปิดดูคูปองนี้ได้
        </p>
      </div>

      <div className="detail-media" style={{ marginTop: 16 }}>
        {coupon.imageUrl ? (
          <CouponImage
            src={toDisplayImageUrl(coupon.imageUrl) ?? coupon.imageUrl}
            alt={`คูปอง ${coupon.title}`}
            originalHref={coupon.imageUrl}
          />
        ) : (
          <div className="detail-placeholder">
            <QrIcon size={34} />
            <p className="small">ไม่มีรูปต้นฉบับ</p>
          </div>
        )}
      </div>

    </div>
  );
}
