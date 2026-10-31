import type { UsageLog } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { CheckIcon, HistoryIcon, PencilIcon, PlusIcon, TrashIcon, UndoIcon } from './Icons';

const ACTION_META: Record<
  UsageLog['action'],
  { label: string; tone: 'success' | 'danger' | 'info' | 'neutral'; icon: 'check' | 'undo' | 'edit' | 'plus' | 'trash' | 'history' }
> = {
  created: { label: 'เพิ่มคูปองเข้าระบบ', tone: 'info', icon: 'plus' },
  updated: { label: 'แก้ไขข้อมูลคูปอง', tone: 'neutral', icon: 'edit' },
  marked_used: { label: 'ทำเครื่องหมายว่าใช้แล้ว', tone: 'success', icon: 'check' },
  undo_used: { label: 'ย้อนกลับเป็นยังไม่ใช้', tone: 'info', icon: 'undo' },
  deleted: { label: 'ลบออกจากรายการ', tone: 'danger', icon: 'trash' },
  restored: { label: 'กู้คืนคูปอง', tone: 'info', icon: 'history' },
};

const FIELD_LABELS: Record<string, string> = {
  title: 'ชื่อคูปอง',
  merchant: 'ร้านค้า',
  discountText: 'ส่วนลด',
  description: 'รายละเอียด',
  couponCode: 'รหัสคูปอง',
  qrRawValue: 'ข้อมูล QR',
  qrType: 'ชนิด QR',
  expiryDate: 'วันหมดอายุ',
  note: 'บันทึกช่วยจำ',
};

function iconFor(name: string) {
  switch (name) {
    case 'check':
      return <CheckIcon size={13} />;
    case 'undo':
      return <UndoIcon size={13} />;
    case 'edit':
      return <PencilIcon size={13} />;
    case 'plus':
      return <PlusIcon size={13} />;
    case 'trash':
      return <TrashIcon size={13} />;
    default:
      return <HistoryIcon size={13} />;
  }
}

function detailFor(log: UsageLog): string | null {
  if (log.action === 'updated') {
    const changed = log.metadata?.changed;
    if (Array.isArray(changed) && changed.length > 0) {
      return `แก้ไข: ${changed.map((field) => FIELD_LABELS[String(field)] ?? String(field)).join(', ')}`;
    }
    return null;
  }
  if (log.action === 'undo_used') {
    const previous = log.metadata?.previousUsedAt;
    if (typeof previous === 'string' && previous) {
      return `เวลาที่ใช้เดิม: ${formatDateTime(previous)}`;
    }
  }
  return null;
}

export function HistoryTimeline({ logs, limit }: { logs: UsageLog[]; limit?: number }) {
  const visible = typeof limit === 'number' ? logs.slice(0, limit) : logs;

  if (visible.length === 0) {
    return <p className="muted small">ยังไม่มีประวัติสำหรับคูปองนี้</p>;
  }

  return (
    <ol className="timeline">
      {visible.map((log) => {
        const meta = ACTION_META[log.action] ?? ACTION_META.created;
        const detail = detailFor(log);
        return (
          <li className="timeline-item" key={log.logId} data-tone={meta.tone}>
            <span className="timeline-dot" aria-hidden="true">
              {iconFor(meta.icon)}
            </span>
            <div className="timeline-body">
              <span className="timeline-action">{meta.label}</span>
              <span className="timeline-time">{formatDateTime(log.at)}</span>
              {detail ? <span className="timeline-detail">{detail}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
