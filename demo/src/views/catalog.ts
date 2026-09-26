import type { Book } from '../catalog.js';
import { formatMoney } from '../money.js';
import { escapeHtml } from './html.js';

export function bookCard(book: Book): string {
  const availability = book.stock > 0 ? `${book.stock} in stock` : 'Sold out';
  return `<li class="book" data-testid="book-card">
  <a href="/book/${book.id}">${escapeHtml(book.title)}</a>
  <span class="author">${escapeHtml(book.author)}</span>
  <span class="price">${formatMoney(book.priceCents)}</span>
  <span class="stock">${availability}</span>
</li>`;
}

export function bookList(books: readonly Book[]): string {
  if (books.length === 0) {
    return '<p data-testid="empty-results">No books found.</p>';
  }
  return `<ul class="books">${books.map(bookCard).join('')}</ul>`;
}

export function bookDetail(book: Book): string {
  const action =
    book.stock > 0
      ? `<form method="post" action="/cart/add">
  <input type="hidden" name="bookId" value="${book.id}">
  <label>Quantity <input name="quantity" type="number" value="1" min="1"></label>
  <button data-testid="add-to-cart">Add to cart</button>
</form>`
      : '<p data-testid="sold-out">Sold out</p>';
  return `<article data-testid="book-detail">
  <p class="author">by ${escapeHtml(book.author)}</p>
  <p class="price" data-testid="price">${formatMoney(book.priceCents)}</p>
  ${action}
</article>`;
}
