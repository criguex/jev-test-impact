import { describe, expect, it } from 'vitest';
import { formatMoney, percentOf, toCents } from '../../src/money.js';

describe('money', () => {
  it('converts amounts to cents without float drift', () => {
    expect(toCents(19.99)).toBe(1999);
  });

  it('formats dollars with thousands separators', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
  });

  it('formats negative amounts and euros', () => {
    expect(formatMoney(-550, 'EUR')).toBe('-€5.50');
  });

  it('rounds percentages to the nearest cent', () => {
    expect(percentOf(999, 10)).toBe(100);
  });
});
