'use client';

import { useState } from 'react';
import { ExpandIcon } from './Icons';
import { ImageViewer } from './ImageViewer';

/**
 * รูปคูปองแบบย่อ — แตะเพื่อเปิดดูเต็มจอ
 * ใช้ในหน้ารายละเอียด/หน้าแชร์ หลังบันทึกแล้ว
 */
export function CouponImage({
  src,
  alt,
  originalHref,
}: {
  src: string;
  alt: string;
  originalHref?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="coupon-image-thumb"
        onClick={() => setOpen(true)}
        aria-label="ดูรูปเต็ม"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span className="coupon-image-hint">
          <ExpandIcon size={13} />
          ดูรูป
        </span>
      </button>

      {open ? (
        <ImageViewer
          src={src}
          alt={alt}
          href={originalHref}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
