import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { CouponActions } from '@/components/CouponActions';
import { HistoryTimeline } from '@/components/HistoryTimeline';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  HistoryIcon,
  QrIcon,
  TicketIcon,
} from '@/components/Icons';
import { CopyButton } from '@/components/CopyButton';
import { CouponImage } from '@/components/CouponImage';
import { getCoupon, listHistory } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { formatDateTime, formatThaiDate, getDisplayStatus, getExpiryLabel } from '@/lib/format';
import { toDisplayImageUrl } from '@/lib/image-url';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  upload: 'อัปโหลด',
  paste: 'วางจาก clipboard',
  share: 'แชร์จากแอป',
  manual: 'กรอกเอง',
};

type PageProps = {
  params: Promise<{ id: string; couponId: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
};

export default async function CouponDetailPage({ params, searchParams }: PageProps) {
  const { id, couponId } = await params;
  const query = await searchParams;
  const actorId = normalizeUserId(id);
  if (!actorId) nextNotFound();

  // ยิง GAS พร้อมกัน (เดิมยิงทีละตัว ทำให้รอสองรอบ)
  const [coupon, logs] = await Promise.all([
    getCoupon(couponId, actorId),
    listHistory(couponId, actorId),
  ]).catch((error) => {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') nextNotFound();
    throw error;
  });
  const displayStatus = getDisplayStatus(coupon);
  const expiry = getExpiryLabel(coupon);

  return (
    <div className="page">
      <Link href={`/user/${actorId}`} className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปหน้ารายการ
      </Link>

      {query.created === '1' ? (
        <p className="notice notice-success" role="status" style={{ marginBottom: 16 }}>
          <CheckCircleIcon size={16} />
          บันทึกคูปองเรียบร้อยแล้ว — ข้อมูลถูกเก็บใน{process.env.GAS_WEB_APP_URL ? ' Google Sheets' : 'ระบบ'}
        </p>
      ) : null}

      {query.updated === '1' ? (
        <p className="notice notice-success" role="status" style={{ marginBottom: 16 }}>
          <CheckCircleIcon size={16} />
          บันทึกการแก้ไขแล้ว
        </p>
      ) : null}

      {coupon.duplicateOf ? (
        <p className="notice notice-warn" style={{ marginBottom: 16 }}>
          คูปองนี้อาจซ้ำกับ{' '}
          <Link href={`/user/${actorId}/coupons/${coupon.duplicateOf}`} style={{ textDecoration: 'underline' }}>
            {coupon.duplicateOf}
          </Link>
        </p>
      ) : null}

      <div className="detail-grid">
        <div>
          <div className="detail-media">
            {coupon.imageUrl ? (
              <CouponImage
                src={toDisplayImageUrl(coupon.imageUrl) ?? coupon.imageUrl}
                alt={`Screenshot คูปอง ${coupon.title}`}
                originalHref={coupon.imageUrl}
              />
            ) : (
              <div className="detail-placeholder">
                <TicketIcon size={34} />
                <p className="small">ไม่มีรูปต้นฉบับสำหรับคูปองนี้</p>
              </div>
            )}
          </div>
        </div>

        <div className="detail-panel">
          <div className="detail-top">
            <div className="detail-sub">
              <span className="coupon-merchant">{coupon.merchant ?? 'คูปอง'}</span>
              <StatusBadge coupon={coupon} />
              {coupon.duplicateOf ? <span className="badge badge-expiring">อาจซ้ำ</span> : null}
            </div>
            <h1 className="detail-title">{coupon.title}</h1>
            {coupon.discountText ? <p className="coupon-discount">{coupon.discountText}</p> : null}
            <div className="detail-sub">
              <span className={`coupon-expiry tone-${expiry.tone}`}>
                <ClockIcon size={14} />
                {expiry.text}
              </span>
              {coupon.status === 'used' && coupon.usedAt ? <span>· ใช้เมื่อ {formatDateTime(coupon.usedAt)}</span> : null}
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

          {coupon.qrRawValue ? (
            <Link href={`/user/${actorId}/coupons/${coupon.couponId}/qr`} className="btn btn-primary btn-block">
              <QrIcon size={17} />
              เปิด QR Code สำหรับใช้ที่ร้าน
            </Link>
          ) : (
            <p className="notice notice-info">
              <QrIcon size={16} />
              คูปองนี้ไม่มี QR Code — ใช้รหัสคูปองด้านบนที่ช่องทางของร้าน
            </p>
          )}

          <CouponActions coupon={coupon} actorId={actorId} />

          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">สถานะ</span>
              <span className="meta-value">
                {displayStatus === 'used'
                  ? 'ใช้แล้ว'
                  : displayStatus === 'expired'
                    ? 'หมดอายุ'
                    : displayStatus === 'expiring'
                      ? 'ใกล้หมดอายุ'
                      : 'ยังไม่ใช้'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">วันหมดอายุ</span>
              <span className="meta-value">{coupon.expiryDate ? formatThaiDate(coupon.expiryDate) : 'ไม่มี'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">วันที่ใช้</span>
              <span className="meta-value">{coupon.usedAt ? formatDateTime(coupon.usedAt) : '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">เพิ่มเมื่อ</span>
              <span className="meta-value">{formatDateTime(coupon.createdAt)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">แก้ไขล่าสุด</span>
              <span className="meta-value">{formatDateTime(coupon.updatedAt)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ความมั่นใจ OCR</span>
              <span className="meta-value">
                {typeof coupon.ocrConfidence === 'number' ? `${Math.round(coupon.ocrConfidence)}%` : '—'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">แหล่งที่มา</span>
              <span className="meta-value">{SOURCE_LABEL[coupon.source] ?? coupon.source}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ชนิด QR</span>
              <span className="meta-value">{coupon.qrType ?? '—'}</span>
            </div>
            <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
              <span className="meta-label">รหัสอ้างอิง</span>
              <span className="meta-value mono">{coupon.couponId}</span>
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
              <p className="meta-label">บันทึกช่วยจำ</p>
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                {coupon.note}
              </p>
            </div>
          ) : null}

          {coupon.ocrTextRaw ? (
            <details className="ocr-details">
              <summary>ข้อความจาก OCR (ต้นฉบับ)</summary>
              <pre className="raw-text">{coupon.ocrTextRaw}</pre>
            </details>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="section-head">
          <div>
            <h2 className="section-title">
              <HistoryIcon size={17} /> ประวัติการใช้งาน
            </h2>
            <p className="section-sub">บันทึกทุกครั้งที่เพิ่ม แก้ไข ใช้ หรือย้อนกลับ</p>
          </div>
          <Link href={`/user/${actorId}/coupons/${coupon.couponId}/history`} className="btn btn-ghost btn-sm">
            ดูทั้งหมด
          </Link>
        </div>
        <HistoryTimeline logs={logs} limit={4} />
      </div>
    </div>
  );
}
