import { describe, expect, it } from 'vitest';
import { matchesAny, matchesGlob } from '../src/glob.js';

describe('matchesGlob', () => {
  it.each([
    ['README.md', '**/*.md', true],
    ['docs/guide/setup.md', '**/*.md', true],
    ['src/a.ts', 'src/*.ts', true],
    ['src/views/a.ts', 'src/*.ts', false],
    ['src/views/a.ts', 'src/**', true],
    ['tests/unit/a.test.ts', 'tests/unit/**/*.test.ts', true],
    ['package.json', 'package.json', true],
    ['demo/package.json', 'package.json', false],
    ['a.tsx', 'a.ts?', true],
  ])('%s against %s is %s', (path, pattern, expected) => {
    expect(matchesGlob(path, pattern)).toBe(expected);
  });

  it('treats regex characters literally', () => {
    expect(matchesGlob('a+b.ts', 'a+b.ts')).toBe(true);
    expect(matchesGlob('aab.ts', 'a+b.ts')).toBe(false);
  });

  it('matches any of several patterns', () => {
    expect(matchesAny('x.md', ['*.ts', '*.md'])).toBe(true);
    expect(matchesAny('x.css', ['*.ts', '*.md'])).toBe(false);
  });
});
