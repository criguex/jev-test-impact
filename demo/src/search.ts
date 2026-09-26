import { listBooks, type Book } from './catalog.js';

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function searchBooks(query: string): Book[] {
  const needle = normalize(query);
  if (needle.length < 2) {
    return [];
  }
  return listBooks().filter((book) => normalize(book.title).includes(needle));
}
