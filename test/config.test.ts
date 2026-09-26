import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

const suites = [{ name: 'unit', runner: 'vitest', include: ['**/*.test.ts'], strategy: 'import-graph' }];

describe('parseConfig', () => {
  it('fills defaults', () => {
    expect(parseConfig({ suites })).toMatchObject({ alwaysRun: [], jev: { threshold: 0.2, maxQuestionsPerCall: 40 } });
  });

  it('rejects configs without suites or with unknown runners', () => {
    expect(() => parseConfig({ suites: [] })).toThrow(/at least one suite/);
    expect(() => parseConfig({ suites: [{ ...suites[0], runner: 'jest' }] })).toThrow(/unsupported runner/);
  });

  it('rejects thresholds outside (0, 1)', () => {
    expect(() => parseConfig({ suites, jev: { threshold: 0 } })).toThrow(/threshold/);
  });
});
