import { describe, expect, it } from 'vitest';
import { byCategory, categories, findBook, listBooks } from '../../src/catalog.js';

describe('catalog', () => {
  it('lists the twelve books in stock order', () => {
    expect(listBooks()).toHaveLength(12);
  });

  it('finds a book by id', () => {
    expect(findBook('b03')?.title).toBe('TypeScript in Depth');
  });

  it('returns undefined for unknown ids', () => {
    expect(findBook('nope')).toBeUndefined();
  });

  it('groups books by category', () => {
    expect(byCategory('testing').map((book) => book.id)).toEqual(['b01', 'b02', 'b09']);
    expect(categories()).toEqual(['architecture', 'design', 'devops', 'programming', 'testing']);
  });
});
