import { percentOf, type Cents } from './money.js';

export interface Discount {
  code: string;
  amountCents: Cents;
}

type Rule = (subtotal: Cents) => Cents;

const rules: Record<string, Rule> = {
  WELCOME10: (subtotal) => percentOf(subtotal, 10),
  BULK5: (subtotal) => (subtotal >= 5000 ? 500 : 0),
  HALFTEST: (subtotal) => Math.min(percentOf(subtotal, 50), 2000),
};

export function isKnownCode(code: string): boolean {
  return Object.hasOwn(rules, code.trim().toUpperCase());
}

export function applyDiscount(subtotal: Cents, code: string | undefined): Discount | null {
  if (!code) {
    return null;
  }
  const normalized = code.trim().toUpperCase();
  const rule = rules[normalized];
  if (!rule) {
    return null;
  }
  return { code: normalized, amountCents: Math.min(rule(subtotal), subtotal) };
}
