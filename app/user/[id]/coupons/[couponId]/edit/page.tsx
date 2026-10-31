import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { ArrowLeftIcon } from '@/components/Icons';
import { EditCouponForm } from '@/components/EditCouponForm';
import { getCoupon } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string; couponId: string }>;
};

export default async function EditCouponPage({ params }: PageProps) {
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

  return (
    <div className="page page-narrow">
      <Link href={`/user/${actorId}/coupons/${coupon.couponId}`} className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปรายละเอียดคูปอง
      </Link>

      <div className="page-head">
        <h1 className="page-title">แก้ไขคูปอง</h1>
        <p className="page-sub">
          {coupon.couponId} · @{actorId} · แก้ไขแล้วระบบจะบันทึกประวัติไว้
        </p>
      </div>

      <EditCouponForm coupon={coupon} actorId={actorId} />
    </div>
  );
}
