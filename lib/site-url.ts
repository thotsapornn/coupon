/**
 * โดเมนที่ใช้สร้างลิงก์แชร์
 * ตั้ง NEXT_PUBLIC_SITE_URL (เช่น https://coupon-weld.vercel.app) เพื่อไม่ให้ลิงก์ติด
 * localhost หรือ dev tunnel ตอนพัฒนา
 */
export function shareBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
