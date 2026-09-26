import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { discoverTests, parseTestFile } from '../src/inventory.js';
import type { SuiteConfig } from '../src/types.js';

const suite: SuiteConfig = { name: 'e2e', runner: 'playwright', include: [], strategy: 'black-box' };

describe('parseTestFile', () => {
  const source = `
import { test, expect } from '@playwright/test';
async function addBook(page, id) { await page.goto('/book/' + id); }
test.describe('cart', () => {
  test('adds a book @cart @smoke', async ({ page }) => {
    await addBook(page, 'b01');
  });
  test.describe('nested', () => {
    test('deep one', async () => {});
  });
});
test('top level', async () => {});
`;
  const tests = parseTestFile('tests/e2e/cart.spec.ts', source, suite);

  it('builds ids from the file and the describe path', () => {
    expect(tests.map((test) => test.id)).toEqual([
      'tests/e2e/cart.spec.ts::cart > adds a book @cart @smoke',
      'tests/e2e/cart.spec.ts::cart > nested > deep one',
      'tests/e2e/cart.spec.ts::top level',
    ]);
  });

  it('records line numbers and tags', () => {
    expect(tests[0]).toMatchObject({ line: 5, tags: ['@cart', '@smoke'], runner: 'playwright', strategy: 'black-box' });
  });

  it('inlines the helpers a test calls so Jev sees the real steps', () => {
    expect(tests[0]!.steps).toContain("page.goto('/book/' + id)");
    expect(tests[2]!.steps).not.toContain('page.goto');
  });
});

describe('discoverTests on the demo app', () => {
  const root = fileURLToPath(new URL('../demo', import.meta.url));
  const tests = discoverTests(root, loadConfig(root));

  it('finds every unit and e2e test', () => {
    expect(tests.filter((test) => test.suite === 'unit')).toHaveLength(46);
    expect(tests.filter((test) => test.suite === 'e2e')).toHaveLength(18);
  });
});
