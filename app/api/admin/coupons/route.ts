import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { ADMIN_USER_ID, isAdminRequest } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { listAllCoupons, listCoupons } from '@/lib/store';
import type { ListStatusFilter } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTERS: ListStatusFilter[] = ['all', 'unused', 'used', 'expired', 'expiring'];

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      throw new ApiError('UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ admin', 401);
    }

    const params = request.nextUrl.searchParams;
    const statusParam = params.get('status') ?? 'all';
    const status = FILTERS.includes(statusParam as ListStatusFilter)
      ? (statusParam as ListStatusFilter)
      : 'all';
    const limit = Number(params.get('limit') ?? 1000);

    const options = {
      status,
      q: params.get('q') ?? '',
      limit: Number.isFinite(limit) ? limit : 1000,
    };

    let result;
    try {
      result = await listAllCoupons(options);
    } catch (error) {
      // GAS เวอร์ชันเก่ายังไม่มี adminListCoupons — ถอยไปใช้ของ admintatar ก่อน
      if (error instanceof ApiError && error.message.includes('adminListCoupons')) {
        result = await listCoupons({ ...options, userId: ADMIN_USER_ID });
      } else {
        throw error;
      }
    }
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
