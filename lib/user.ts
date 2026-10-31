export const USER_ID_PATTERN = /^[a-z0-9_-]{2,30}$/;

/** id ที่ผู้ใช้ตั้งเอง: a-z, 0-9, - และ _ ยาว 2–30 */
export function normalizeUserId(raw: string | string[] | null | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase();
  return USER_ID_PATTERN.test(value) ? value : null;
}
