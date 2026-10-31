import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkAdminPassword,
  createAdminSession,
  verifyAdminSession,
} from '../lib/auth';

const NOW = 1_800_000_000_000; // fixed timestamp (ms)

describe('admin auth', () => {
  const original = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = '2600';
    delete process.env.ADMIN_SESSION_SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = original;
  });

  it('accepts the configured password only', () => {
    expect(checkAdminPassword('2600')).toBe(true);
    expect(checkAdminPassword('2601')).toBe(false);
    expect(checkAdminPassword('')).toBe(false);
    expect(checkAdminPassword('26000')).toBe(false);
  });

  it('creates a session that verifies before it expires', () => {
    const token = createAdminSession(NOW);
    expect(verifyAdminSession(token, NOW + 1000)).toBe(true);
  });

  it('rejects an expired session', () => {
    const token = createAdminSession(NOW);
    const thirteenHours = NOW + 13 * 60 * 60 * 1000;
    expect(verifyAdminSession(token, thirteenHours)).toBe(false);
  });

  it('rejects tampered or malformed tokens', () => {
    const token = createAdminSession(NOW);
    const [expires, signature] = token.split('.');

    expect(verifyAdminSession(`${Number(expires) + 60}.${signature}`, NOW)).toBe(false);
    expect(verifyAdminSession(`${expires}.deadbeef`, NOW)).toBe(false);
    expect(verifyAdminSession('not-a-token', NOW)).toBe(false);
    expect(verifyAdminSession(undefined, NOW)).toBe(false);
    expect(verifyAdminSession('', NOW)).toBe(false);
  });

  it('returns false when no password is configured', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkAdminPassword('2600')).toBe(false);
    expect(() => createAdminSession(NOW)).toThrow();
    expect(verifyAdminSession('123.sig', NOW)).toBe(false);
  });
});
