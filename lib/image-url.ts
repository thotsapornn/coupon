/**
 * Google Drive เก็บรูปไว้ที่ /file/d/{id}/view ซึ่งเปิดใน <img> ไม่ได้
 * (เป็นหน้า HTML ไม่ใช่รูป) — แปลงเป็น thumbnail endpoint ก่อนแสดงผล
 */
const DRIVE_FILE_PATTERN = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/;
const DRIVE_OPEN_PATTERN = /^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/;

export function toDisplayImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const id = url.match(DRIVE_FILE_PATTERN)?.[1] ?? url.match(DRIVE_OPEN_PATTERN)?.[1];
  if (!id) return url;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}
