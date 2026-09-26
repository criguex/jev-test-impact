import type { Cents } from './money.js';

export type ShippingMethod = 'standard' | 'express' | 'pickup';

const base: Record<ShippingMethod, Cents> = { standard: 500, express: 1500, pickup: 0 };
const perExtraItem: Record<ShippingMethod, Cents> = { standard: 100, express: 200, pickup: 0 };

export function shippingFor(itemCount: number, method: ShippingMethod): Cents {
  if (itemCount <= 0) {
    return 0;
  }
  return base[method] + perExtraItem[method] * (itemCount - 1);
}

export function isShippingMethod(value: string): value is ShippingMethod {
  return value in base;
}
