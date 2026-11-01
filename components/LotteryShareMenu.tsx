'use client';

import { useRef } from 'react';
import { useLotteryShare, type ShareMode, type ShareMethod } from './LotteryShareContext';
import { CopyIcon, ShareIcon } from './Icons';

export function LotteryShareMenu({
  mode,
  label,
}: {
  mode: ShareMode;
  label: string;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const { isDisabled, requestShare } = useLotteryShare();

  function choose(method: ShareMethod) {
    if (menuRef.current) menuRef.current.open = false;
    void requestShare(mode, method);
  }

  return (
    <details className={`lottery-share-menu is-${mode}`} ref={menuRef}>
      <summary className={mode === 'full' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
        <ShareIcon size={15} /> {label} <span aria-hidden="true">⌄</span>
      </summary>
      <div className="lottery-share-menu-options" aria-label={`ตัวเลือก${label}`}>
        <button
          type="button"
          className="lottery-share-option"
          onClick={() => choose('line')}
          disabled={isDisabled(mode)}
        >
          <span className="lottery-share-option-icon is-line" aria-hidden="true">L</span>
          <span className="lottery-share-option-copy">
            <strong>ส่งผ่าน LINE</strong>
            <small>เปิด LINE พร้อมลิงก์</small>
          </span>
        </button>
        <button
          type="button"
          className="lottery-share-option"
          onClick={() => choose('copy')}
          disabled={isDisabled(mode)}
        >
          <span className="lottery-share-option-icon" aria-hidden="true">
            <CopyIcon size={16} />
          </span>
          <span className="lottery-share-option-copy">
            <strong>คัดลอกลิงก์</strong>
            <small>นำ URL ไปวางที่อื่น</small>
          </span>
        </button>
      </div>
    </details>
  );
}
