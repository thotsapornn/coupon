import Link from 'next/link';
import { PlusIcon, TicketIcon } from './Icons';

export function EmptyState({
  title = 'ยังไม่มีคูปองในมุมมองนี้',
  text = 'อัปโหลด Screenshot คูปองใบแรก แล้วระบบจะอ่าน QR และข้อความให้อัตโนมัติ',
  showAction = true,
  addHref = '/user',
}: {
  title?: string;
  text?: string;
  showAction?: boolean;
  addHref?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-art">
        <TicketIcon size={30} />
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-text">{text}</p>
      {showAction ? (
        <Link href={addHref} className="btn btn-primary" style={{ marginTop: 10 }}>
          <PlusIcon size={16} />
          เพิ่มคูปอง
        </Link>
      ) : null}
    </div>
  );
}
