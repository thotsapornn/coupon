import type { Metadata } from 'next';
import { AdminCouponList } from '@/components/AdminCouponList';
import { AdminLogin } from '@/components/AdminLogin';
import { adminConfigured, isAdminRequest } from '@/lib/auth';
import { listAllCoupons } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'จัดการคูปอง',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <div className="page page-narrow">
        <p className="notice notice-error">
          ยังไม่ได้ตั้งค่า ADMIN_PASSWORD — เพิ่ม environment variable แล้ว redeploy
        </p>
      </div>
    );
  }

  if (!(await isAdminRequest())) {
    return <AdminLogin />;
  }

  const { items } = await listAllCoupons({ limit: 1000 });

  return (
    <div className="page page-narrow">
      <AdminCouponList coupons={items} />
    </div>
  );
}
