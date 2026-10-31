import Link from 'next/link';
import { notFound as nextNotFound } from 'next/navigation';
import { CouponList } from '@/components/CouponList';
import { EmptyState } from '@/components/EmptyState';
import { PlusIcon, SparklesIcon } from '@/components/Icons';
import { getStats, listCoupons } from '@/lib/store';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function UserWalletPage({ params }: PageProps) {
  const { id } = await params;
  const userId = normalizeUserId(id);
  if (!userId) nextNotFound();

  const [coupons, stats] = await Promise.all([
    listCoupons({ userId, limit: 1000 }),
    getStats(userId),
  ]);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <SparklesIcon size={14} />
            @{userId}
          </span>
          <h1 className="hero-title">คูปองของฉัน</h1>
          <p className="hero-sub">id: {userId} · เก็บคูปองแยกจาก user อื่น</p>
        </div>

        <div className="hero-actions">
          <Link href={`/user/${userId}/new`} className="btn btn-primary">
            <PlusIcon size={16} />
            เพิ่มคูปอง
          </Link>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat">
          <p className="stat-value">{stats.unused}</p>
          <p className="stat-label">ยังไม่ใช้</p>
        </div>
        <div className={`stat${stats.expiring > 0 ? ' is-warn' : ''}`}>
          <p className="stat-value">{stats.expiring}</p>
          <p className="stat-label">ใกล้หมดอายุ</p>
        </div>
        <div className={`stat${stats.used > 0 ? ' is-muted' : ''}`}>
          <p className="stat-value">{stats.used}</p>
          <p className="stat-label">ใช้แล้ว</p>
        </div>
      </div>

      {coupons.items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีคูปอง"
          text={`เริ่มเก็บคูปองใบแรกของ @${userId} ได้เลย`}
          addHref={`/user/${userId}/new`}
        />
      ) : (
        <CouponList coupons={coupons.items} addHref={`/user/${userId}/new`} />
      )}

      <Link href={`/user/${userId}/new`} className="fab">
        <PlusIcon size={18} />
        เพิ่มคูปอง
      </Link>
    </div>
  );
}
