import { describe, expect, it } from 'vitest';
import { applyDiscount, isKnownCode } from '../../src/pricing.js';

describe('pricing', () => {
  it('gives ten percent with WELCOME10', () => {
    expect(applyDiscount(3200, 'WELCOME10')).toEqual({ code: 'WELCOME10', amountCents: 320 });
  });

  it('normalizes code casing and spaces', () => {
    expect(applyDiscount(3200, '  welcome10 ')?.code).toBe('WELCOME10');
  });

  it('applies BULK5 only from fifty dollars', () => {
    expect(applyDiscount(4999, 'BULK5')?.amountCents).toBe(0);
    expect(applyDiscount(5000, 'BULK5')?.amountCents).toBe(500);
  });

  it('caps HALFTEST at twenty dollars', () => {
    expect(applyDiscount(10000, 'HALFTEST')?.amountCents).toBe(2000);
  });

  it('ignores unknown or empty codes', () => {
    expect(applyDiscount(3200, 'FREE')).toBeNull();
    expect(applyDiscount(3200, undefined)).toBeNull();
  });

  it('recognizes known codes', () => {
    expect(isKnownCode('bulk5')).toBe(true);
    expect(isKnownCode('free')).toBe(false);
  });
});
