import type { Coupon } from '@/lib/types';
import { getDisplayStatus, statusLabel } from '@/lib/format';

export function StatusBadge({ coupon }: { coupon: Coupon }) {
  const status = getDisplayStatus(coupon);
  return <span className={`badge badge-${status}`}>{statusLabel(status)}</span>;
}
