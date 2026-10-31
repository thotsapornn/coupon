import type { NextRequest } from 'next/server';
import { fail, ok, withIdempotency } from '@/lib/api';
import { markUsed } from '@/lib/store';
import { validationError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const userId = normalizeUserId(request.nextUrl.searchParams.get('userId'));
    if (!userId) throw validationError('ต้องระบุ userId ใน query');
    const coupon = await withIdempotency(request.headers.get('idempotency-key'), () =>
      markUsed(id, userId),
    );
    return ok({ coupon });
  } catch (error) {
    return fail(error);
  }
}
