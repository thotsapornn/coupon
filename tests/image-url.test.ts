import { describe, expect, it } from 'vitest';
import { toDisplayImageUrl } from '../lib/image-url';

describe('toDisplayImageUrl', () => {
  it('แปลง Drive /view เป็น thumbnail', () => {
    expect(toDisplayImageUrl('https://drive.google.com/file/d/ABC_123-x/view?usp=sharing')).toBe(
      'https://drive.google.com/thumbnail?id=ABC_123-x&sz=w1200',
    );
  });

  it('แปลง Drive /open?id= เป็น thumbnail', () => {
    expect(toDisplayImageUrl('https://drive.google.com/open?id=XYZ789')).toBe(
      'https://drive.google.com/thumbnail?id=XYZ789&sz=w1200',
    );
  });

  it('คง URL อื่นไว้เหมือนเดิม', () => {
    expect(toDisplayImageUrl('/api/images/CPN-1.svg')).toBe('/api/images/CPN-1.svg');
    expect(toDisplayImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });

  it('คืน undefined เมื่อไม่มีรูป', () => {
    expect(toDisplayImageUrl(undefined)).toBeUndefined();
    expect(toDisplayImageUrl('')).toBeUndefined();
  });
});
