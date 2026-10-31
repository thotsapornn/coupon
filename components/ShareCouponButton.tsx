'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { CheckIcon, ShareIcon } from './Icons';

export function ShareCouponButton({
  couponId,
  title,
  label = 'แชร์',
  className = 'btn btn-secondary',
  copyOnly = false,
}: {
  couponId: string;
  title: string;
  label?: string;
  className?: string;
  copyOnly?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);

  function shareUrl(): string {
    return `${window.location.origin}/share/${encodeURIComponent(couponId)}`;
  }

  async function handleShare() {
    const url = shareUrl();

    if (!copyOnly && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url });
        setStatus('แชร์แล้ว');
        window.setTimeout(() => setStatus(null), 2000);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }

    await copyText(url);
    setStatus('คัดลอกลิงก์แล้ว');
    window.setTimeout(() => setStatus(null), 2000);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      aria-label={`${label} ${title}`}
      aria-live="polite"
    >
      {status ? <CheckIcon size={15} /> : <ShareIcon size={15} />}
      {status ?? label}
    </button>
  );
}
