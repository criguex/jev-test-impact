import { describe, expect, it } from 'vitest';
import { findBook } from '../../src/catalog.js';
import { bookCard, bookList } from '../../src/views/catalog.js';
import { escapeHtml } from '../../src/views/html.js';

describe('views', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<b>"Tom" & \'Jerry\'</b>')).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });

  it('renders price and stock on a book card', () => {
    const html = bookCard(findBook('b01')!);
    expect(html).toContain('$32.00');
    expect(html).toContain('5 in stock');
  });

  it('marks sold out books', () => {
    expect(bookCard(findBook('b06')!)).toContain('Sold out');
  });

  it('renders an empty state', () => {
    expect(bookList([])).toContain('No books found.');
  });
});
