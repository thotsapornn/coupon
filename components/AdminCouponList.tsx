'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Coupon, ListStatusFilter } from '@/lib/types';
import { filterCoupons, matchesStatus, sortCoupons } from '@/lib/filter';
import { getDisplayStatus } from '@/lib/format';
import { toDisplayImageUrl } from '@/lib/image-url';
import { ConfirmDialog } from './ConfirmDialog';
import { AlertIcon, InfoIcon, SearchIcon, ShieldIcon, TicketIcon, TrashIcon } from './Icons';

const FILTERS: Array<{ key: ListStatusFilter; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'unused', label: 'ยังไม่ใช้' },
  { key: 'expiring', label: 'ใกล้หมดอายุ' },
  { key: 'expired', label: 'หมดอายุ' },
  { key: 'used', label: 'ใช้แล้ว' },
];

const STATUS_LABEL: Record<string, string> = {
  unused: 'ยังไม่ใช้',
  used: 'ใช้แล้ว',
  expired: 'หมดอายุ',
  expiring: 'ใกล้หมดอายุ',
};

export function AdminCouponList({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<ListStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<Coupon | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const filter of FILTERS) {
      result[filter.key] = coupons.filter((coupon) => matchesStatus(coupon, filter.key)).length;
    }
    return result;
  }, [coupons]);

  const visible = useMemo(
    () => sortCoupons(filterCoupons(coupons, { status, q: query })),
    [coupons, status, query],
  );

  const visibleIds = visible.map((coupon) => coupon.couponId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggle(couponId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function purge(couponId: string): Promise<void> {
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
      method: 'DELETE',
    });
    const payload = (await response.json()) as { ok: boolean; error?: { message?: string } };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `ลบ ${couponId} ไม่สำเร็จ`);
    }
  }

  async function runSingle() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await purge(target.couponId);
      setNotice(`ลบ ${target.couponId} แล้ว`);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(target.couponId);
        return next;
      });
      setTarget(null);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    let done = 0;
    const failed: string[] = [];

    for (const id of ids) {
      try {
        await purge(id);
        done += 1;
      } catch {
        failed.push(id);
      }
    }

    setSelected(new Set(failed));
    setBusy(false);
    setBulkOpen(false);
    setNotice(
      failed.length === 0
        ? `ลบ ${done} ใบแล้ว`
        : `ลบสำเร็จ ${done} ใบ · ล้มเหลว ${failed.length} ใบ`,
    );
    if (failed.length > 0) setError(`ลบไม่สำเร็จ: ${failed.join(', ')}`);
    router.refresh();
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">
            <ShieldIcon size={14} />
            admintatar
          </span>
          <h1 className="hero-title">จัดการคูปอง</h1>
          <p className="hero-sub">เห็นคูปองของทุก user · ลบถาวรได้ทุกใบ</p>
        </div>
        <div className="admin-head-actions">
          <Link href="/user/admintatar" className="btn btn-secondary btn-sm">
            เปิดกระเป๋า
          </Link>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <p className="notice notice-error" role="alert">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      ) : null}

      <p className="notice notice-warn">
        <AlertIcon size={16} />
        <span>การลบในหน้านี้ถาวร — ลบแถวใน Google Sheets และไฟล์รูปใน Drive กู้คืนไม่ได้</span>
      </p>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="กรองตามสถานะ">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="tab"
              aria-pressed={status === filter.key}
              onClick={() => setStatus(filter.key)}
            >
              {filter.label}
              <span className="tab-count">{counts[filter.key]}</span>
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
            placeholder="ค้นหาชื่อ ร้าน รหัส หรือ user id…"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="result-line">
        <label className="admin-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            disabled={visible.length === 0}
          />
          เลือกทั้งหมด ({visible.length})
        </label>

        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => setBulkOpen(true)}
          disabled={selected.size === 0 || busy}
        >
          <TrashIcon size={14} />
          ลบที่เลือก ({selected.size})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty-art">
            <TicketIcon size={30} />
          </span>
          <p className="empty-title">ไม่พบคูปอง</p>
          <p className="empty-text">
            {query ? 'ลองค้นหาด้วยคำที่สั้นลง' : 'ยังไม่มีคูปองของ admintatar'}
          </p>
        </div>
      ) : (
        <ul className="admin-list">
          {visible.map((coupon) => {
            const checked = selected.has(coupon.couponId);
            const image = toDisplayImageUrl(coupon.imageUrl);
            return (
              <li key={coupon.couponId} className={`admin-row${checked ? ' is-selected' : ''}`}>
                <label className="admin-check" aria-label={`เลือก ${coupon.couponId}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(coupon.couponId)}
                  />
                </label>

                <span className="admin-thumb">
                  {image && coupon.imageStatus === 'ok' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={`รูป ${coupon.title}`} loading="lazy" />
                  ) : (
                    <TicketIcon size={20} />
                  )}
                </span>

                <div className="admin-info">
                  <strong className="admin-title">{coupon.title}</strong>
                  <span className="small muted">
                    @{coupon.userId} · {coupon.couponId} ·{' '}
                    {STATUS_LABEL[getDisplayStatus(coupon)] ?? coupon.status}
                  </span>
                  <span className="small muted">
                    {coupon.merchant ? `${coupon.merchant} · ` : ''}
                    {coupon.expiryDate ? `หมดอายุ ${coupon.expiryDate}` : 'ไม่มีวันหมดอายุ'}
                  </span>
                </div>

                <div className="admin-actions">
                  {image ? (
                    <a
                      href={coupon.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      ดูรูป
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setTarget(coupon)}
                    disabled={busy}
                  >
                    <TrashIcon size={14} />
                    ลบ
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="notice notice-info" style={{ marginTop: 16 }}>
        <InfoIcon size={16} />
        <span>ลบแล้วจะเหลือร่องรอยในแท็บ UsageHistory เป็น action admin_deleted</span>
      </p>

      <ConfirmDialog
        open={Boolean(target)}
        title="ลบคูปองนี้ถาวร?"
        text={
          target
            ? `${target.couponId} — ${target.title} · แถวใน Sheets และไฟล์ใน Drive จะถูกลบถาวร`
            : ''
        }
        confirmLabel="ลบถาวร"
        tone="danger"
        busy={busy}
        requireText={target?.couponId}
        onConfirm={() => void runSingle()}
        onCancel={() => {
          if (!busy) setTarget(null);
        }}
      />

      <ConfirmDialog
        open={bulkOpen}
        title={`ลบ ${selected.size} ใบถาวร?`}
        text="ทุกใบที่เลือกจะถูกลบทั้งแถวใน Sheets และไฟล์ใน Drive — กู้คืนไม่ได้"
        confirmLabel="ลบทั้งหมด"
        tone="danger"
        busy={busy}
        requireText="DELETE"
        onConfirm={() => void runBulk()}
        onCancel={() => {
          if (!busy) setBulkOpen(false);
        }}
      />
    </>
  );
}
