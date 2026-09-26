import { describe, expect, it } from 'vitest';
import { isShippingMethod, shippingFor } from '../../src/shipping.js';

describe('shipping', () => {
  it('charges nothing for an empty order', () => {
    expect(shippingFor(0, 'express')).toBe(0);
  });

  it('charges the standard base for one item', () => {
    expect(shippingFor(1, 'standard')).toBe(500);
  });

  it('adds a fee per extra item', () => {
    expect(shippingFor(3, 'express')).toBe(1900);
  });

  it('keeps pickup free', () => {
    expect(shippingFor(5, 'pickup')).toBe(0);
  });

  it('validates method names', () => {
    expect(isShippingMethod('express')).toBe(true);
    expect(isShippingMethod('drone')).toBe(false);
  });
});
