import { fail, ok } from '@/lib/api';
import { ADMIN_USER_ID, isAdminRequest } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { purgeCoupon } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    if (!(await isAdminRequest())) {
      throw new ApiError('UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ admin', 401);
    }

    const { id } = await context.params;
    if (!/^CPN-[0-9]{6}-[0-9]{3}$/.test(id)) {
      throw new ApiError('VALIDATION_ERROR', 'couponId ไม่ถูกต้อง', 400);
    }

    await purgeCoupon(id, ADMIN_USER_ID);
    return ok({ couponId: id, deleted: true });
  } catch (error) {
    return fail(error);
  }
}
