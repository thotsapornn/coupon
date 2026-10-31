import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_TTL_SECONDS,
  adminConfigured,
  checkAdminPassword,
  createAdminSession,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; first: number; blockedUntil?: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'ยังไม่ได้ตั้งค่า ADMIN_PASSWORD' } },
      { status: 500 },
    );
  }

  const key = clientKey(request);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่' } },
      { status: 429 },
    );
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    password = '';
  }

  if (!checkAdminPassword(password)) {
    const next: { count: number; first: number; blockedUntil?: number } =
      entry && now - entry.first < WINDOW_MS
        ? { ...entry, count: entry.count + 1 }
        : { count: 1, first: now };
    if (next.count >= MAX_ATTEMPTS) next.blockedUntil = now + WINDOW_MS;
    attempts.set(key, next);

    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'รหัสผ่านไม่ถูกต้อง' } },
      { status: 401 },
    );
  }

  attempts.delete(key);

  const response = NextResponse.json({ ok: true, data: { admin: true } });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_SECONDS,
  });
  return response;
}
