import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/Icons';
import { UserEntry } from '@/components/UserEntry';

export const metadata = {
  title: 'เข้ากระเป๋าคูปอง',
};

export default function UserEntryPage() {
  return (
    <div className="page page-narrow">
      <Link href="/qr" className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปสร้าง QR
      </Link>

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
