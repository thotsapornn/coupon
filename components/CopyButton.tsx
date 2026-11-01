'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { CheckIcon, CopyIcon } from './Icons';

export function CopyButton({
  value,
  label = 'คัดลอก',
  className = 'btn btn-secondary btn-sm',
  copiedLabel = 'คัดลอกแล้ว',
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={copy}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      aria-live="polite"
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {iconOnly ? null : copied ? copiedLabel : label}
    </button>
  );
}
