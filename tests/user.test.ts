import { describe, expect, it } from 'vitest';
import { normalizeUserId } from '../lib/user';

describe('user ids', () => {
  it('normalizes valid ids to lowercase and trims', () => {
    expect(normalizeUserId(' Tar ')).toBe('tar');
    expect(normalizeUserId('demo_01')).toBe('demo_01');
    expect(normalizeUserId('a-b')).toBe('a-b');
    expect(normalizeUserId('demo_user')).toBe('demo_user');
  });

  it('rejects invalid ids', () => {
    expect(normalizeUserId('')).toBeNull();
    expect(normalizeUserId('a')).toBeNull();
    expect(normalizeUserId('bad id')).toBeNull();
    expect(normalizeUserId('ไทย')).toBeNull();
    expect(normalizeUserId('x'.repeat(31))).toBeNull();
  });

  it('accepts an array (Next searchParams) and uses the first value', () => {
    expect(normalizeUserId(['tar', 'demo'])).toBe('tar');
  });
});
