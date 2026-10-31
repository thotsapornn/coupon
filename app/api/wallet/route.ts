import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { validationError } from '@/lib/errors';
import { getStats, listCoupons } from '@/lib/store';
import { normalizeUserId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = normalizeUserId(request.nextUrl.searchParams.get('userId'));
    if (!userId) throw validationError('ต้องระบุ userId ใน query');

    const [list, stats] = await Promise.all([
      listCoupons({ userId, limit: 1000 }),
      getStats(userId),
    ]);

    return ok({ items: list.items, total: list.total, stats });
  } catch (error) {
    return fail(error);
  }
}
