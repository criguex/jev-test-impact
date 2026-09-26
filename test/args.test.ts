import { describe, expect, it } from 'vitest';
import { planSuite, runnerArgs, shellQuote } from '../src/args.js';
import type { Selection } from '../src/types.js';
import { testCase } from './helpers.js';

const unitA = testCase({ file: 'tests/unit/a.test.ts', titlePath: ['money', 'rounds (half) up'], line: 4 });
const unitB = testCase({ file: 'tests/unit/b.test.ts', titlePath: ['b'], line: 9 });
const e2e = testCase({ file: 'tests/e2e/c.spec.ts', titlePath: ['c'], line: 12, suite: 'e2e', runner: 'playwright', strategy: 'black-box' });
const usage = { calls: 0, questions: 0, inputTokens: 0, fromFixtures: 0 };

describe('runnerArgs', () => {
  it('gives Playwright file:line locations', () => {
    expect(runnerArgs('playwright', [e2e, e2e])).toEqual(['tests/e2e/c.spec.ts:12']);
  });

  it('gives Vitest files plus an anchored, escaped name pattern for old and new separators', () => {
    expect(runnerArgs('vitest', [unitA, unitB])).toEqual([
      'tests/unit/a.test.ts',
      'tests/unit/b.test.ts',
      '-t',
      '^(?:money(?: > | )rounds \\(half\\) up|b)$',
    ]);
  });
});

describe('planSuite', () => {
  const partial: Selection = { mode: 'partial', selected: [{ test: unitA, reasons: [] }], skipped: [unitB, e2e], jev: usage };

  it('runs a subset when only some tests were picked', () => {
    expect(planSuite(partial, 'unit')).toMatchObject({ action: 'some', tests: [unitA] });
  });

  it('skips a suite with no picked tests', () => {
    expect(planSuite(partial, 'e2e')).toEqual({ action: 'skip' });
  });

  it('runs everything in full mode', () => {
    expect(planSuite({ mode: 'full', why: 'x', tests: [unitA], jev: usage }, 'e2e')).toEqual({ action: 'all' });
  });

  it('runs everything when every test of the suite was picked', () => {
    const all: Selection = { mode: 'partial', selected: [{ test: e2e, reasons: [] }], skipped: [unitB], jev: usage };
    expect(planSuite(all, 'e2e')).toEqual({ action: 'all' });
  });
});

describe('shellQuote', () => {
  it('leaves safe words alone and quotes the rest', () => {
    expect(shellQuote('tests/a.spec.ts:12')).toBe('tests/a.spec.ts:12');
    expect(shellQuote("^(?:it's)$")).toBe(`'^(?:it'\\''s)$'`);
  });
});
