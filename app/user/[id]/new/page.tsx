import Link from 'next/link';
import { AddCouponFlow } from '@/components/AddCouponFlow';
import { ArrowLeftIcon } from '@/components/Icons';
import { notFound as nextNotFound } from 'next/navigation';
import { listCoupons } from '@/lib/store';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'เพิ่มคูปอง',
};

type PageProps = { params: Promise<{ id: string }> };

export default async function NewCouponPage({ params }: PageProps) {
  const { id } = await params;
  const actorId = normalizeUserId(id);
  if (!actorId) nextNotFound();

  const { items } = await listCoupons({ userId: actorId, limit: 500 });
  const existing = items.map((coupon) => ({
    couponId: coupon.couponId,
    title: coupon.title,
    qrRawValue: coupon.qrRawValue,
    couponCode: coupon.couponCode,
  }));

  return (
    <div className="page">
      <Link href={`/user/${actorId}`} className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปหน้ารายการ
      </Link>

      <div className="page-head">
        <h1 className="page-title">เพิ่มคูปอง</h1>
        <p className="page-sub">
          @{actorId} · อัปโหลดหรือถ่ายรูป 1 ใบ ระบบอ่าน QR/ข้อความให้ แล้วตรวจสอบก่อนบันทึก
        </p>
      </div>

      <AddCouponFlow existing={existing} userId={actorId} />
    </div>
  );
}
