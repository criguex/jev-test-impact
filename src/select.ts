import { matchesAny, matchesGlob } from './glob.js';
import type { ImportGraph } from './graph.js';
import type { AmbiguityJudge } from './jev/judge.js';
import type { FileChange, ImpactConfig, JevUsage, Reason, Selection, TestCase } from './types.js';

export interface SelectInput {
  changes: FileChange[];
  tests: TestCase[];
  config: ImpactConfig;
  graph: ImportGraph;
  judge: AmbiguityJudge;
}

class Picks {
  private readonly reasons = new Map<string, Reason[]>();

  add(test: TestCase, reason: Reason): void {
    const list = this.reasons.get(test.id) ?? [];
    list.push(reason);
    this.reasons.set(test.id, list);
  }

  has(test: TestCase): boolean {
    return this.reasons.has(test.id);
  }

  reasonsFor(test: TestCase): Reason[] | undefined {
    return this.reasons.get(test.id);
  }
}

function pathsOf(change: FileChange): string[] {
  return change.previousPath ? [change.path, change.previousPath] : [change.path];
}

function fullSuiteTrigger(changes: FileChange[], config: ImpactConfig): string | undefined {
  const hit = changes.find((change) => pathsOf(change).some((path) => matchesAny(path, config.fullSuiteOn)));
  return hit ? `${hit.path} affects every test (fullSuiteOn)` : undefined;
}

function applyDeterministic(changes: FileChange[], tests: TestCase[], config: ImpactConfig, graph: ImportGraph, picks: Picks): void {
  for (const test of tests) {
    for (const tag of config.alwaysRun) {
      if (test.tags.includes(tag)) {
        picks.add(test, { kind: 'always-run', tag });
      }
    }
  }
  for (const change of changes) {
    const paths = pathsOf(change);
    for (const test of tests) {
      if (paths.includes(test.file)) {
        picks.add(test, { kind: 'test-file-changed', file: change.path });
        continue;
      }
      const closure = graph.closure(test.file);
      if (paths.some((path) => closure.has(path))) {
        picks.add(test, { kind: 'import-graph', file: change.path });
      }
    }
    for (const rule of config.owners) {
      if (!paths.some((path) => rule.files.some((pattern) => matchesGlob(path, pattern)))) {
        continue;
      }
      for (const test of tests) {
        const tag = rule.tags.find((candidate) => test.tags.includes(candidate));
        if (tag) {
          picks.add(test, { kind: 'owner', file: change.path, tag });
        }
      }
    }
  }
}

export async function selectTests(input: SelectInput): Promise<Selection> {
  const { config, tests, graph, judge } = input;
  const usage: JevUsage = { calls: 0, questions: 0, inputTokens: 0, fromFixtures: 0 };
  const changes = input.changes.filter((change) => !pathsOf(change).every((path) => matchesAny(path, config.ignore)));

  const trigger = fullSuiteTrigger(changes, config);
  if (trigger) {
    return { mode: 'full', why: trigger, tests, jev: usage };
  }

  const picks = new Picks();
  applyDeterministic(changes, tests, config, graph, picks);

  const testFiles = new Set(tests.map((test) => test.file));
  const blackBox = tests.filter((test) => test.strategy === 'black-box');
  const ambiguous = changes.filter((change) => !pathsOf(change).some((path) => testFiles.has(path)));

  try {
    for (const change of ambiguous) {
      const candidates = blackBox.filter((test) => !picks.has(test));
      if (candidates.length === 0) {
        break;
      }
      if (change.binary || change.hunks.length === 0) {
        candidates.forEach((test) => picks.add(test, { kind: 'unreadable-change', file: change.path }));
        continue;
      }
      const verdicts = await judge.judge(change, candidates);
      usage.calls += verdicts.calls;
      usage.questions += verdicts.questions;
      usage.inputTokens += verdicts.inputTokens;
      for (const test of candidates) {
        const probability = verdicts.probabilities.get(test.id) ?? 1;
        if (probability >= config.jev.threshold) {
          picks.add(test, { kind: 'jev', file: change.path, probability });
        }
      }
    }
  } catch (error) {
    return { mode: 'full', why: `${judge.name} could not decide (${(error as Error).message}); running everything`, tests, jev: usage };
  }

  return {
    mode: 'partial',
    selected: tests.filter((test) => picks.has(test)).map((test) => ({ test, reasons: picks.reasonsFor(test)! })),
    skipped: tests.filter((test) => !picks.has(test)),
    jev: usage,
  };
}
