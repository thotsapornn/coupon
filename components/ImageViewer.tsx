'use client';

import { useEffect } from 'react';
import { XIcon } from './Icons';

export function ImageViewer({
  src,
  alt,
  href,
  onClose,
  onEdit,
}: {
  src: string;
  alt: string;
  /** ลิงก์รูปต้นฉบับ (เช่น Google Drive) */
  href?: string;
  onClose: () => void;
  /** ถ้าไม่ส่งมา จะไม่แสดงปุ่มแก้ไข/ครอป */
  onEdit?: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="modal-backdrop viewer-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="ดูรูปคูปอง"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <div className="image-viewer-actions">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              เปิดต้นฉบับ
            </a>
          ) : null}
          {onEdit ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              แก้ไข / ครอป
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            <XIcon size={15} />
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
