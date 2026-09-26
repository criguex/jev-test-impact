import { describe, expect, it } from 'vitest';
import { assertAvailable, available, OutOfStockError } from '../../src/inventory.js';

describe('inventory', () => {
  it('reports remaining stock after reservations', () => {
    expect(available('b04', 1)).toBe(1);
  });

  it('reports zero for unknown books', () => {
    expect(available('missing')).toBe(0);
  });

  it('rejects quantities above stock', () => {
    expect(() => assertAvailable('b10', 2)).toThrow(OutOfStockError);
  });
});
