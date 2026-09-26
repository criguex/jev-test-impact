import { findBook } from './catalog.js';

export class OutOfStockError extends Error {
  constructor(readonly bookId: string) {
    super(`Book ${bookId} is out of stock`);
  }
}

export function available(bookId: string, alreadyReserved = 0): number {
  const book = findBook(bookId);
  return book ? Math.max(book.stock - alreadyReserved, 0) : 0;
}

export function assertAvailable(bookId: string, quantity: number, alreadyReserved = 0): void {
  if (quantity > available(bookId, alreadyReserved)) {
    throw new OutOfStockError(bookId);
  }
}
