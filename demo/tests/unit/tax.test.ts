import { describe, expect, it } from 'vitest';
import { taxFor, taxRate } from '../../src/tax.js';

describe('tax', () => {
  it('uses the US rate', () => {
    expect(taxFor(10000, 'US')).toBe(700);
  });

  it('uses the Colombian VAT rate', () => {
    expect(taxRate('CO')).toBe(19);
  });

  it('uses the EU rate', () => {
    expect(taxFor(1000, 'EU')).toBe(210);
  });

  it('never taxes negative amounts', () => {
    expect(taxFor(-500, 'US')).toBe(0);
  });
});
