import { NextResponse } from 'next/server';
import { ApiError } from './errors';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: error.code, message: error.message, fields: error.fields },
      },
      { status: error.status },
    );
  }
  console.error('[api] unexpected error', error);
  return NextResponse.json(
    {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่' },
    },
    { status: 500 },
  );
}

/** กันกดซ้ำ: เก็บผลลัพธ์ของ idempotency key ไว้ 10 นาที (เฉพาะโปรเซสนี้) */
const idempotencyCache = new Map<string, { at: number; value: unknown }>();
const IDEMPOTENCY_TTL = 10 * 60_000;

export async function withIdempotency<T>(key: string | null, run: () => Promise<T>): Promise<T> {
  if (!key) return run();

  const cached = idempotencyCache.get(key);
  if (cached && Date.now() - cached.at < IDEMPOTENCY_TTL) {
    return cached.value as T;
  }

  const value = await run();
  idempotencyCache.set(key, { at: Date.now(), value });

  if (idempotencyCache.size > 500) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL;
    for (const [cacheKey, entry] of idempotencyCache) {
      if (entry.at < cutoff) idempotencyCache.delete(cacheKey);
    }
  }
  return value;
}
