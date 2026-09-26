export type Cents = number;

export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function formatMoney(cents: Cents, currency = 'USD'): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100).toLocaleString('en-US');
  const fraction = String(absolute % 100).padStart(2, '0');
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${sign}${symbol}${whole}.${fraction}`;
}

export function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100);
}
