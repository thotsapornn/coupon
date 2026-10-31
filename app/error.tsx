'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertIcon } from '@/components/Icons';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page page-narrow">
      <div className="empty" style={{ marginTop: 40 }}>
        <span className="empty-art" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          <AlertIcon size={30} />
        </span>
        <p className="empty-title">เกิดข้อผิดพลาด</p>
        <p className="empty-text">
          {error.message || 'ระบบไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            ลองใหม่
          </button>
          <Link href="/" className="btn btn-secondary">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}
