'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TicketIcon } from './Icons';

const LAST_USER_KEY = 'cw:last-user';

function userIdFromPath(pathname: string): string | null {
  const match = /^\/user\/([^/]+)/.exec(pathname);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]).toLowerCase();
    return /^[a-z0-9_-]{2,30}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function BrandLink() {
  const pathname = usePathname() || '/';
  const pathUserId = userIdFromPath(pathname);
  const [lastUserId, setLastUserId] = useState<string | null>(pathUserId);

  useEffect(() => {
    if (pathUserId) {
      setLastUserId(pathUserId);
      try {
        window.localStorage.setItem(LAST_USER_KEY, pathUserId);
      } catch {
        /* ignore storage errors */
      }
      return;
    }

    try {
      const stored = window.localStorage.getItem(LAST_USER_KEY);
      setLastUserId(stored && /^[a-z0-9_-]{2,30}$/.test(stored) ? stored : null);
    } catch {
      setLastUserId(null);
    }
  }, [pathUserId, pathname]);

  const href = pathUserId
    ? `/user/${pathUserId}`
    : lastUserId
      ? `/user/${lastUserId}`
      : '/';

  return (
    <Link href={href} className="brand" aria-label="Coupon Wallet — กลับกระเป๋าคูปอง">
      <span className="brand-mark">
        <TicketIcon size={19} />
      </span>
      <span className="brand-text">
        <strong>Coupon Wallet</strong>
        <span>{pathUserId || lastUserId ? 'กลับกระเป๋าของฉัน' : 'สร้าง QR · เก็บคูปอง'}</span>
      </span>
    </Link>
  );
}
