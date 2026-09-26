import type { Runner, Selection, TestCase } from './types.js';

export type SuitePlan = { action: 'all' } | { action: 'skip' } | { action: 'some'; args: string[]; tests: TestCase[] };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function runnerArgs(runner: Runner, tests: TestCase[]): string[] {
  if (runner === 'playwright') {
    return [...new Set(tests.map((test) => `${test.file}:${test.line}`))];
  }
  const files = [...new Set(tests.map((test) => test.file))];
  const names = [...new Set(tests.map((test) => test.titlePath.map(escapeRegex).join('(?: > | )')))];
  return [...files, '-t', `^(?:${names.join('|')})$`];
}

export function planSuite(selection: Selection, suite: string): SuitePlan {
  if (selection.mode === 'full') {
    return { action: 'all' };
  }
  const tests = selection.selected.map((entry) => entry.test).filter((test) => test.suite === suite);
  if (tests.length === 0) {
    return { action: 'skip' };
  }
  const total = tests.length + selection.skipped.filter((test) => test.suite === suite).length;
  if (tests.length === total) {
    return { action: 'all' };
  }
  return { action: 'some', args: runnerArgs(tests[0]!.runner, tests), tests };
}

export function shellQuote(arg: string): string {
  return /^[\w./:@=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}
