import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { createShare, getShare } from '@/lib/store';
import { parseWithSchema, shareCreateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** สร้างลิงก์แชร์แบบสั้น: เก็บ payload ไว้ใน Drive แล้วคืน key */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kind, data } = parseWithSchema(shareCreateSchema, body);
    const share = await createShare(kind, data);
    return ok({ key: share.key }, 201);
  } catch (error) {
    return fail(error);
  }
}

/** อ่าน payload ของลิงก์แชร์จาก key */
export async function GET(request: NextRequest) {
  try {
    const key = (request.nextUrl.searchParams.get('key') ?? '').trim().toLowerCase();
    const share = await getShare(key);
    if (!share) throw notFound('ไม่พบลิงก์แชร์นี้');
    return ok({ kind: share.kind, data: share.data });
  } catch (error) {
    return fail(error);
  }
}
