'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { normalizeUserId } from '@/lib/user';
import { ChevronRightIcon, InfoIcon, TicketIcon } from './Icons';

export function UserEntry() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const userId = normalizeUserId(value);
    if (!userId) {
      setError('id ใช้ได้เฉพาะ a-z, 0-9, - และ _ ยาว 2–30 ตัว');
      return;
    }
    router.push(`/user/${userId}`);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="user-id">id ของคุณ</label>
        <input
          id="user-id"
          name="userId"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="เช่น tar, demo"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          aria-invalid={Boolean(error)}
        />
        <p className="field-hint">ตั้งเองได้ ใช้แยกข้อมูลคูปองของแต่ละคน</p>
        {error ? <p className="field-error">{error}</p> : null}
      </div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="btn btn-primary btn-block">
          <TicketIcon size={16} />
          เข้ากระเป๋าคูปอง
          <ChevronRightIcon size={15} />
        </button>
      </div>

      <p className="notice notice-info" style={{ marginTop: 14 }}>
        <InfoIcon size={16} />
        <span>แต่ละ id เห็นเฉพาะคูปองของตัวเอง</span>
      </p>
    </form>
  );
}
