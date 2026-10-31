'use client';

import { useState } from 'react';
import { ExpandIcon } from './Icons';

export function FullscreenButton({ targetId }: { targetId: string }) {
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const target = document.getElementById(targetId);
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      } else {
        setError('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มหน้าจอ');
      }
    } catch {
      setError('เปิดโหมดเต็มหน้าจอไม่สำเร็จ');
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={toggle}>
        <ExpandIcon size={14} />
        เต็มหน้าจอ
      </button>
      {error ? <span className="field-error">{error}</span> : null}
    </>
  );
}
