import type { CartSummary } from '../cart.js';
import { formatMoney } from '../money.js';
import { escapeHtml } from './html.js';

function line(summaryLine: CartSummary['lines'][number]): string {
  const { book, quantity } = summaryLine;
  return `<tr data-testid="cart-line">
  <td>${escapeHtml(book.title)}</td>
  <td>
    <form method="post" action="/cart/quantity">
      <input type="hidden" name="bookId" value="${book.id}">
      <input name="quantity" type="number" value="${quantity}" min="0" aria-label="Quantity for ${escapeHtml(book.title)}">
      <button>Update</button>
    </form>
  </td>
  <td>${formatMoney(book.priceCents * quantity)}</td>
  <td><form method="post" action="/cart/remove"><input type="hidden" name="bookId" value="${book.id}"><button data-testid="remove">Remove</button></form></td>
</tr>`;
}

export function totals(summary: CartSummary): string {
  const discount = summary.discount
    ? `<dt>Discount (${summary.discount.code})</dt><dd data-testid="discount">-${formatMoney(summary.discount.amountCents)}</dd>`
    : '';
  return `<dl class="totals">
  <dt>Subtotal</dt><dd data-testid="subtotal">${formatMoney(summary.subtotalCents)}</dd>
  ${discount}
  <dt>Tax</dt><dd data-testid="tax">${formatMoney(summary.taxCents)}</dd>
  <dt>Shipping</dt><dd data-testid="shipping">${formatMoney(summary.shippingCents)}</dd>
  <dt>Total</dt><dd data-testid="total">${formatMoney(summary.totalCents)}</dd>
</dl>`;
}

export function cartPage(summary: CartSummary, message?: string): string {
  const notice = message ? `<p role="status" data-testid="cart-message">${escapeHtml(message)}</p>` : '';
  if (summary.lines.length === 0) {
    return `${notice}<p data-testid="empty-cart">Your cart is empty.</p>`;
  }
  return `${notice}
<table class="cart"><tbody>${summary.lines.map(line).join('')}</tbody></table>
<form method="post" action="/cart/discount">
  <input name="code" aria-label="Discount code" placeholder="Discount code">
  <button data-testid="apply-discount">Apply</button>
</form>
${totals(summary)}
<a href="/checkout" data-testid="go-checkout">Checkout</a>`;
}
