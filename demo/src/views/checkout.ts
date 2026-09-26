import type { CartSummary } from '../cart.js';
import { escapeHtml } from './html.js';
import { totals } from './cart.js';

const methods = [
  ['standard', 'Standard (3-5 days)'],
  ['express', 'Express (next day)'],
  ['pickup', 'Store pickup'],
] as const;

export function checkoutPage(summary: CartSummary, selected: string): string {
  const options = methods
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="method" value="${value}" ${value === selected ? 'checked' : ''}> ${label}</label>`,
    )
    .join('');
  return `<form method="get" action="/checkout" data-testid="shipping-form">
  <fieldset><legend>Shipping</legend>${options}</fieldset>
  <button data-testid="update-shipping">Update shipping</button>
</form>
${totals(summary)}
<form method="post" action="/checkout">
  <input type="hidden" name="method" value="${escapeHtml(selected)}">
  <button data-testid="place-order">Place order</button>
</form>`;
}

export function confirmationPage(orderId: string, totalLabel: string): string {
  return `<p data-testid="confirmation">Order <strong>${escapeHtml(orderId)}</strong> confirmed. We charged ${escapeHtml(totalLabel)}.</p>`;
}
