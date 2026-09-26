import { percentOf, type Cents } from './money.js';

export type Region = 'CO' | 'US' | 'EU';

const rates: Record<Region, number> = { CO: 19, US: 7, EU: 21 };

export function taxRate(region: Region): number {
  return rates[region];
}

export function taxFor(taxable: Cents, region: Region): Cents {
  return percentOf(Math.max(taxable, 0), rates[region]);
}
