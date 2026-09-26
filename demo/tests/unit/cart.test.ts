import { describe, expect, it } from 'vitest';
import { Cart } from '../../src/cart.js';
import { OutOfStockError } from '../../src/inventory.js';

describe('cart', () => {
  it('starts empty', () => {
    expect(new Cart().summary().itemCount).toBe(0);
  });

  it('accumulates quantities for the same book', () => {
    const cart = new Cart();
    cart.add('b01');
    cart.add('b01', 2);
    expect(cart.lines()).toEqual([expect.objectContaining({ quantity: 3 })]);
  });

  it('refuses to exceed stock', () => {
    const cart = new Cart();
    cart.add('b04', 2);
    expect(() => cart.add('b04')).toThrow(OutOfStockError);
  });

  it('computes subtotal, tax, shipping and total', () => {
    const cart = new Cart();
    cart.add('b01');
    cart.add('b02');
    expect(cart.summary('US', 'standard')).toMatchObject({
      subtotalCents: 6000,
      taxCents: 420,
      shippingCents: 600,
      totalCents: 7020,
    });
  });

  it('applies the discount before tax', () => {
    const cart = new Cart();
    cart.add('b03');
    cart.useDiscount('WELCOME10');
    expect(cart.summary('US', 'pickup')).toMatchObject({ taxCents: 284, totalCents: 4334 });
  });

  it('removes lines when quantity drops to zero', () => {
    const cart = new Cart();
    cart.add('b05', 2);
    cart.setQuantity('b05', 0);
    expect(cart.lines()).toEqual([]);
  });
});
