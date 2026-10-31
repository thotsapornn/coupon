import { ok } from '@/lib/api';
import { nowIso } from '@/lib/format';
import { storeMode } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return ok({
    mode: storeMode(),
    serverTime: nowIso(),
  });
}
