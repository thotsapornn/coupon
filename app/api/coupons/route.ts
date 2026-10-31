import type { NextRequest } from 'next/server';
import { fail, ok, withIdempotency } from '@/lib/api';
import { createCoupon, listCoupons } from '@/lib/store';
import { createCouponSchema, parseWithSchema } from '@/lib/validation';
import { validationError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';
import type { ListStatusFilter } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTERS: ListStatusFilter[] = ['all', 'unused', 'used', 'expired', 'expiring'];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const userId = normalizeUserId(params.get('userId'));
    if (!userId) throw validationError('ต้องระบุ userId ใน query');
    const statusParam = params.get('status') ?? 'all';
    const status = (FILTERS.includes(statusParam as ListStatusFilter) ? statusParam : 'all') as ListStatusFilter;
    const limit = Number(params.get('limit') ?? 500);
    const result = await listCoupons({
      userId,
      status,
      q: params.get('q') ?? '',
      limit: Number.isFinite(limit) ? limit : 500,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseWithSchema(createCouponSchema, body);
    const { imageBase64, imageMimeType, userId: rawUserId, ...input } = parsed;
    const userId = normalizeUserId(rawUserId);
    if (!userId) throw validationError('userId ไม่ถูกต้อง (a-z, 0-9, - _ ความยาว 2–30)');
    const base64 = imageBase64.includes(',') ? imageBase64.split(',').pop() ?? '' : imageBase64;

    const coupon = await withIdempotency(request.headers.get('idempotency-key'), () =>
      createCoupon(userId, input, { base64, mimeType: imageMimeType }),
    );
    return ok({ coupon }, 201);
  } catch (error) {
    return fail(error);
  }
}
