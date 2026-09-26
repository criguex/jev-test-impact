import type { ImpactConfig, TestCase } from '../src/types.js';

export function testCase(overrides: Partial<TestCase> & Pick<TestCase, 'file'>): TestCase {
  const titlePath = overrides.titlePath ?? ['case'];
  return {
    id: `${overrides.file}::${titlePath.join(' > ')}`,
    suite: 'unit',
    runner: 'vitest',
    strategy: 'import-graph',
    line: 1,
    tags: [],
    steps: '',
    ...overrides,
    titlePath,
  };
}

export const baseConfig: ImpactConfig = {
  suites: [
    { name: 'unit', runner: 'vitest', include: ['tests/unit/**/*.test.ts'], strategy: 'import-graph' },
    { name: 'e2e', runner: 'playwright', include: ['tests/e2e/**/*.spec.ts'], strategy: 'black-box' },
  ],
  alwaysRun: ['@smoke'],
  fullSuiteOn: ['package.json'],
  ignore: ['**/*.md'],
  owners: [{ files: ['src/auth.ts'], tags: ['@auth'] }],
  jev: { threshold: 0.2, maxQuestionsPerCall: 2 },
};
