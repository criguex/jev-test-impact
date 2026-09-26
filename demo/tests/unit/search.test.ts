import { describe, expect, it } from 'vitest';
import { searchBooks } from '../../src/search.js';

describe('search', () => {
  it('matches titles case-insensitively', () => {
    expect(searchBooks('TESTING').map((book) => book.id)).toEqual(['b09']);
  });

  it('ignores accents in the query', () => {
    expect(searchBooks('pipéline').map((book) => book.id)).toEqual(['b05']);
  });

  it('returns nothing for one-letter queries', () => {
    expect(searchBooks('a')).toEqual([]);
  });

  it('returns nothing when no title matches', () => {
    expect(searchBooks('cooking')).toEqual([]);
  });
});
