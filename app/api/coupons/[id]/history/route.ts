import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { listHistory } from '@/lib/store';
import { validationError } from '@/lib/errors';
import { normalizeUserId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const userId = normalizeUserId(request.nextUrl.searchParams.get('userId'));
    if (!userId) throw validationError('ต้องระบุ userId ใน query');
    return ok({ logs: await listHistory(id, userId) });
  } catch (error) {
    return fail(error);
  }
}
