import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/Icons';
import { UserEntry } from '@/components/UserEntry';
import { BackLink } from '@/components/BackLink';

export const metadata = {
  title: 'เข้ากระเป๋าคูปอง',
};

export default function UserEntryPage() {
  return (
    <div className="page page-narrow">
      <BackLink fallback="/qr">
        กลับไปสร้าง QR
      </BackLink>

      <div className="page-head">
        <h1 className="page-title">กระเป๋าคูปอง</h1>
        <p className="page-sub">
          พิมพ์ id ที่ตั้งเองเพื่อเข้าดูคูปอง — ข้อมูลแยกตาม id
        </p>
      </div>

      <UserEntry />
    </div>
  );
}
