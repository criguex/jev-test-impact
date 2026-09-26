import books from './catalog.json' with { type: 'json' };
import type { Cents } from './money.js';

export interface Book {
  id: string;
  title: string;
  author: string;
  priceCents: Cents;
  stock: number;
  category: string;
}

const catalog: readonly Book[] = books;

export function listBooks(): readonly Book[] {
  return catalog;
}

export function findBook(id: string): Book | undefined {
  return catalog.find((book) => book.id === id);
}

export function byCategory(category: string): Book[] {
  return catalog.filter((book) => book.category === category);
}

export function categories(): string[] {
  return [...new Set(catalog.map((book) => book.category))].sort();
}
