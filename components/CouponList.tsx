'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Coupon, ListStatusFilter } from '@/lib/types';
import { filterCoupons, matchesStatus, sortCoupons } from '@/lib/filter';
import { CouponCard } from './CouponCard';
import { EmptyState } from './EmptyState';
import { GridIcon, ListIcon, SearchIcon } from './Icons';

// เรียงตามความสำคัญ: ที่ต้องใช้ก่อน → ใกล้หมดอายุ → หมดอายุ → ใช้แล้ว
const TABS: Array<{ key: ListStatusFilter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'unused', label: 'ยังไม่ใช้' },
  { key: 'expiring', label: 'ใกล้หมดอายุ' },
  { key: 'expired', label: 'หมดอายุ' },
  { key: 'used', label: 'ใช้แล้ว' },
];

export function CouponList({ coupons, addHref }: { coupons: Coupon[]; addHref?: string }) {
  const [status, setStatus] = useState<ListStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('cw:coupon-view-2');
      if (stored === 'grid' || stored === 'list') setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function changeView(next: 'grid' | 'list') {
    setView(next);
    try {
      window.localStorage.setItem('cw:coupon-view-2', next);
    } catch {
      /* ignore */
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const tab of TABS) {
      result[tab.key] = coupons.filter((coupon) => matchesStatus(coupon, tab.key)).length;
    }
    return result;
  }, [coupons]);

  const visible = useMemo(() => {
    return sortCoupons(filterCoupons(coupons, { status, q: query }));
  }, [coupons, status, query]);

  return (
    <>
      <div className="toolbar">
        <div className="tabs" role="group" aria-label="กรองตามสถานะ">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="tab"
              aria-pressed={status === tab.key}
              onClick={() => setStatus(tab.key)}
            >
              {tab.label}
              <span className="tab-count">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        <label className="search">
          <span className="visually-hidden">ค้นหาคูปอง</span>
          <SearchIcon size={18} />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อร้าน รหัสคูปอง หรือส่วนลด…"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="result-line">
        <span>
          {query ? `ผลการค้นหา “${query}” · ` : ''}
          {visible.length} ใบ
        </span>
        <div className="view-toggle" role="group" aria-label="รูปแบบการแสดงผล">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => changeView('list')}
          >
            <ListIcon size={13} />
            รายการ
          </button>
          <button
            type="button"
            aria-pressed={view === 'grid'}
            onClick={() => changeView('grid')}
          >
            <GridIcon size={13} />
            กริด
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? 'ไม่พบคูปองที่ค้นหา' : 'ยังไม่มีคูปองในหมวดนี้'}
          text={
            query
              ? 'ลองค้นหาด้วยชื่อร้านหรือรหัสคูปองที่สั้นลง'
              : status === 'used'
                ? 'เมื่อกดใช้คูปองแล้ว คูปองจะย้ายมาอยู่ในหมวดนี้'
                : 'อัปโหลด Screenshot คูปองเพื่อเริ่มเก็บคูปองใบแรก'
          }
          showAction={!query}
          addHref={addHref}
        />
      ) : (
        <div className={`coupon-grid view-${view}`}>
          {visible.map((coupon) => (
            <CouponCard key={coupon.couponId} coupon={coupon} />
          ))}
        </div>
      )}
    </>
  );
}
