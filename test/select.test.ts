import { describe, expect, it } from 'vitest';
import type { ImportGraph } from '../src/graph.js';
import type { AmbiguityJudge, Verdicts } from '../src/jev/judge.js';
import { selectTests } from '../src/select.js';
import type { FileChange, Selection, TestCase } from '../src/types.js';
import { baseConfig, testCase } from './helpers.js';

const unitPricing = testCase({ file: 'tests/unit/pricing.test.ts', titlePath: ['pricing'] });
const unitAuth = testCase({ file: 'tests/unit/auth.test.ts', titlePath: ['auth'] });
const e2e = (title: string, tags: string[] = []) =>
  testCase({ file: 'tests/e2e/app.spec.ts', titlePath: [title], suite: 'e2e', runner: 'playwright', strategy: 'black-box', tags });
const cart = e2e('cart', ['@cart']);
const login = e2e('login', ['@auth']);
const smoke = e2e('home', ['@smoke']);
const tests = [unitPricing, unitAuth, cart, login, smoke];

const graph = {
  closure: (file: string) =>
    new Set(
      ({
        'tests/unit/pricing.test.ts': ['tests/unit/pricing.test.ts', 'src/pricing.ts', 'src/money.ts'],
        'tests/unit/auth.test.ts': ['tests/unit/auth.test.ts', 'src/auth.ts'],
      } as Record<string, string[]>)[file] ?? [file],
    ),
} as unknown as ImportGraph;

const change = (path: string, extra: Partial<FileChange> = {}): FileChange => ({
  path,
  status: 'modified',
  binary: false,
  hunks: [{ header: '@@ -1 +1 @@', removed: ['a'], added: ['b'] }],
  ...extra,
});

class FakeJudge implements AmbiguityJudge {
  readonly name = 'fake';
  readonly asked: string[][] = [];

  constructor(private readonly answers: Record<string, number> | Error) {}

  async judge(_change: FileChange, candidates: TestCase[]): Promise<Verdicts> {
    if (this.answers instanceof Error) {
      throw this.answers;
    }
    this.asked.push(candidates.map((test) => test.id));
    const answers = this.answers;
    return {
      probabilities: new Map(candidates.map((test) => [test.id, answers[test.id] ?? 0])),
      calls: 1,
      questions: candidates.length,
      inputTokens: 100,
    };
  }
}

const run = (changes: FileChange[], judge: AmbiguityJudge) => selectTests({ changes, tests, config: baseConfig, graph, judge });

function picked(selection: Selection): string[] {
  if (selection.mode === 'full') {
    return ['FULL'];
  }
  return selection.selected.map((entry) => entry.test.titlePath.join(' '));
}

describe('selectTests', () => {
  it('uses the import graph for unit tests and always keeps smoke tests', async () => {
    const selection = await run([change('src/money.ts')], new FakeJudge({}));
    expect(picked(selection)).toEqual(['pricing', 'home']);
  });

  it('adds black-box tests that Jev rates at or above the threshold', async () => {
    const judge = new FakeJudge({ [cart.id]: 0.2, [login.id]: 0.19 });
    const selection = await run([change('src/pricing.ts')], judge);
    expect(picked(selection)).toEqual(['pricing', 'cart', 'home']);
    expect(judge.asked).toEqual([[cart.id, login.id]]);
  });

  it('never asks Jev about tests an owner rule already selected', async () => {
    const judge = new FakeJudge({});
    const selection = await run([change('src/auth.ts')], judge);
    expect(picked(selection)).toEqual(['auth', 'login', 'home']);
    expect(judge.asked).toEqual([[cart.id]]);
  });

  it('runs the whole suite when Jev fails', async () => {
    const selection = await run([change('src/pricing.ts')], new FakeJudge(new Error('429 via gateway')));
    expect(selection.mode).toBe('full');
    expect(selection.mode === 'full' && selection.why).toContain('429 via gateway');
  });

  it('runs the whole suite when a fullSuiteOn file changes', async () => {
    const selection = await run([change('package.json')], new FakeJudge({}));
    expect(selection).toMatchObject({ mode: 'full', why: 'package.json affects every test (fullSuiteOn)' });
  });

  it('ignores documentation-only changes without calling Jev', async () => {
    const judge = new FakeJudge({});
    expect(picked(await run([change('README.md')], judge))).toEqual(['home']);
    expect(judge.asked).toEqual([]);
  });

  it('selects every black-box test when a change has no readable diff', async () => {
    const selection = await run([change('public/logo.png', { binary: true, hunks: [] })], new FakeJudge({}));
    expect(picked(selection)).toEqual(['cart', 'login', 'home']);
  });

  it('runs a changed test file without asking Jev', async () => {
    const judge = new FakeJudge({});
    const selection = await run([change('tests/e2e/app.spec.ts')], judge);
    expect(picked(selection)).toEqual(['cart', 'login', 'home']);
    expect(judge.asked).toEqual([]);
  });

  it('matches renames on the old path too', async () => {
    const selection = await run([change('src/auth-v2.ts', { previousPath: 'src/auth.ts', status: 'renamed' })], new FakeJudge({}));
    expect(picked(selection)).toContain('auth');
  });

  it('explains every pick', async () => {
    const selection = await run([change('src/pricing.ts')], new FakeJudge({ [cart.id]: 0.9 }));
    expect(selection.mode === 'partial' && selection.selected.map((entry) => entry.reasons[0]!.kind)).toEqual(['import-graph', 'jev', 'always-run']);
  });
});
