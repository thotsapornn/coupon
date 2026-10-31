import Link from 'next/link';
import { TicketIcon } from '@/components/Icons';

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <div className="empty" style={{ marginTop: 40 }}>
        <span className="empty-art">
          <TicketIcon size={30} />
        </span>
        <p className="empty-title">ไม่พบคูปองนี้</p>
        <p className="empty-text">คูปองอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 10 }}>
          กลับไปหน้ารายการ
        </Link>
      </div>
    </div>
  );
}
