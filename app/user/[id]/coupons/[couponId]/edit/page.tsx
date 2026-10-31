import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { EditCouponForm } from '@/components/EditCouponForm';
import { getCoupon } from '@/lib/store';
import { ApiError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';
import { BackLink } from '@/components/BackLink';

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
      <BackLink fallback={`/user/${actorId}/coupons/${coupon.couponId}`}>
        กลับไปรายละเอียดคูปอง
      </BackLink>

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
