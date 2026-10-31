import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { HistoryTimeline } from '@/components/HistoryTimeline';
import { ArrowLeftIcon, HistoryIcon } from '@/components/Icons';
import { getCoupon, listHistory } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string; couponId: string }> };

export default async function CouponHistoryPage({ params }: PageProps) {
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

  const logs = await listHistory(couponId, actorId);

  return (
    <div className="page page-narrow">
      <Link href={`/user/${actorId}/coupons/${coupon.couponId}`} className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปรายละเอียดคูปอง
      </Link>

      <div className="page-head">
        <h1 className="page-title">
          <HistoryIcon size={26} /> ประวัติการใช้งาน
        </h1>
        <p className="page-sub">
          {coupon.title} · {coupon.couponId}
        </p>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">เหตุการณ์ทั้งหมด</h2>
            <p className="section-sub">
              {logs.length} รายการ ·  createdAt {formatDateTime(coupon.createdAt)}
            </p>
          </div>
        </div>
        <HistoryTimeline logs={logs} />
      </div>
    </div>
  );
}
