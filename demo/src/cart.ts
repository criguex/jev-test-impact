import { findBook, type Book } from './catalog.js';
import { assertAvailable } from './inventory.js';
import type { Cents } from './money.js';
import { applyDiscount, type Discount } from './pricing.js';
import { shippingFor, type ShippingMethod } from './shipping.js';
import { taxFor, type Region } from './tax.js';

export interface CartLine {
  book: Book;
  quantity: number;
}

export interface CartSummary {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: Cents;
  discount: Discount | null;
  taxCents: Cents;
  shippingCents: Cents;
  totalCents: Cents;
}

export class Cart {
  private readonly quantities = new Map<string, number>();
  private discountCode: string | undefined;

  add(bookId: string, quantity = 1): void {
    if (!findBook(bookId)) {
      throw new Error(`Unknown book ${bookId}`);
    }
    const current = this.quantities.get(bookId) ?? 0;
    assertAvailable(bookId, quantity, current);
    this.quantities.set(bookId, current + quantity);
  }

  setQuantity(bookId: string, quantity: number): void {
    if (quantity <= 0) {
      this.quantities.delete(bookId);
      return;
    }
    assertAvailable(bookId, quantity);
    this.quantities.set(bookId, quantity);
  }

  remove(bookId: string): void {
    this.quantities.delete(bookId);
  }

  useDiscount(code: string | undefined): void {
    this.discountCode = code;
  }

  clear(): void {
    this.quantities.clear();
    this.discountCode = undefined;
  }

  lines(): CartLine[] {
    return [...this.quantities].map(([bookId, quantity]) => ({ book: findBook(bookId)!, quantity }));
  }

  summary(region: Region = 'US', method: ShippingMethod = 'standard'): CartSummary {
    const lines = this.lines();
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalCents = lines.reduce((sum, line) => sum + line.book.priceCents * line.quantity, 0);
    const discount = applyDiscount(subtotalCents, this.discountCode);
    const taxable = subtotalCents - (discount?.amountCents ?? 0);
    const taxCents = taxFor(taxable, region);
    const shippingCents = shippingFor(itemCount, method);
    return {
      lines,
      itemCount,
      subtotalCents,
      discount,
      taxCents,
      shippingCents,
      totalCents: taxable + taxCents + shippingCents,
    };
  }
}
