'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertIcon, ShieldIcon } from './Icons';

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? 'เข้าสู่ระบบไม่สำเร็จ');
      }

      setPassword('');
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <ShieldIcon size={14} />
            admin
          </span>
          <h1 className="hero-title">หน้าจัดการคูปอง</h1>
          <p className="hero-sub">สำหรับเจ้าของ id admintatar เท่านั้น</p>
        </div>
      </div>

      <form className="panel" onSubmit={submit}>
        {error ? (
          <p className="notice notice-error" role="alert">
            <AlertIcon size={16} />
            {error}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="admin-password">รหัสผ่าน</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            placeholder="••••"
            aria-invalid={Boolean(error)}
          />
          <p className="field-hint">ใช้ได้ 12 ชั่วโมงหลังเข้าสู่ระบบ</p>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
            <ShieldIcon size={16} />
            {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </form>
    </div>
  );
}
