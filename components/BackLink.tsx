'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from './Icons';

/**
 * ปุ่มย้อนกลับที่ใช้ history จริง (แทน <Link> ที่ push entry ใหม่)
 * ทำให้กดย้อนกลับจากหน้า QR แล้วกลับไปหน้าที่มาจากจริง ๆ
 */
export function BackLink({
  fallback,
  children,
}: {
  fallback: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button type="button" className="back-link" onClick={goBack}>
      <ArrowLeftIcon size={15} />
      {children}
    </button>
  );
}
