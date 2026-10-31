import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { deleteCoupon, getCoupon, updateCoupon } from '@/lib/store';
import { parseWithSchema, updateCouponSchema } from '@/lib/validation';
import { validationError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function actorOf(request: NextRequest): string {
  const userId = normalizeUserId(request.nextUrl.searchParams.get('userId'));
  if (!userId) throw validationError('ต้องระบุ userId ใน query');
  return userId;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    return ok({ coupon: await getCoupon(id, actorOf(request)) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const patch = parseWithSchema(updateCouponSchema, body);
    return ok({ coupon: await updateCoupon(id, actorOf(request), patch) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    return ok({ coupon: await deleteCoupon(id, actorOf(request)) });
  } catch (error) {
    return fail(error);
  }
}
