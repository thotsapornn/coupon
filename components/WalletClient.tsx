'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import useSWR from 'swr';
import type { Coupon } from '@/lib/types';
import { CouponList } from './CouponList';
import { EmptyState } from './EmptyState';
import { PlusIcon, SparklesIcon } from './Icons';

export interface WalletStats {
  total: number;
  unused: number;
  used: number;
  expiring: number;
  expired: number;
}

export interface WalletData {
  items: Coupon[];
  total: number;
  stats: WalletStats;
}

const fetcher = async (url: string): Promise<WalletData> => {
  const response = await fetch(url);
  const payload = (await response.json()) as {
    ok: boolean;
    data?: WalletData;
    error?: { message?: string };
  };
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? 'โหลดข้อมูลไม่สำเร็จ');
  }
  return payload.data;
};

export function WalletClient({ userId, initial }: { userId: string; initial: WalletData }) {
  const { data, mutate } = useSWR<WalletData>(`/api/wallet?userId=${encodeURIComponent(userId)}`, fetcher, {
    fallbackData: initial,
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  // หลัง router.refresh() ฝั่ง server ส่งข้อมูลใหม่มา — sync เข้า cache ของ SWR
  useEffect(() => {
    void mutate(initial, { revalidate: false });
  }, [initial, mutate]);

  const view = data ?? initial;
  const stats = view.stats;

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

      {view.items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีคูปอง"
          text={`เริ่มเก็บคูปองใบแรกของ @${userId} ได้เลย`}
          addHref={`/user/${userId}/new`}
        />
      ) : (
        <CouponList coupons={view.items} addHref={`/user/${userId}/new`} />
      )}

      <Link href={`/user/${userId}/new`} className="fab">
        <PlusIcon size={18} />
        เพิ่มคูปอง
      </Link>
    </div>
  );
}
