import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { planSuite } from '../src/args.js';
import { analyze, type Policy } from '../src/engine.js';
import type { Selection } from '../src/types.js';
import { buildHistory, git, repoRoot } from './history.js';
import type { TruthCommit } from './truth.js';

const PRICE_PER_MILLION_INPUT = 0.042;
const policies: Policy[] = ['naive', 'safe', 'jev'];

interface CommitResult {
  sha: string;
  subject: string;
  changed: string[];
  total: number;
  newlyFailing: string[];
  policies: Record<Policy, { mode: string; selected: number; missed: string[]; testMs: number; wallMs?: number; why?: string }>;
  caughtOnlyByJev: { id: string; probability: number }[];
  fullTestMs: number;
  fullWallMs: number;
}

function selectedIds(selection: Selection): Set<string> {
  return new Set(selection.mode === 'full' ? selection.tests.map((test) => test.id) : selection.selected.map((entry) => entry.test.id));
}

function timedRun(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): number {
  const started = performance.now();
  try {
    execFileSync('npx', args, { cwd, stdio: 'ignore', env: { ...process.env, ...env } });
  } catch {
    return performance.now() - started;
  }
  return performance.now() - started;
}

function executeSelection(work: string, selection: Selection): number {
  let total = 0;
  const unit = planSuite(selection, 'unit');
  if (unit.action !== 'skip') {
    total += timedRun(work, ['vitest', 'run', '--config', 'vitest.config.ts', ...(unit.action === 'some' ? unit.args : [])]);
  }
  const e2e = planSuite(selection, 'e2e');
  if (e2e.action !== 'skip') {
    total += timedRun(work, ['playwright', 'test', '--config', 'playwright.config.ts', '--reporter=dot', '--retries=0', ...(e2e.action === 'some' ? e2e.args : [])], { DEMO_PORT: '4392' });
  }
  return Math.round(total);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${((100 * part) / whole).toFixed(1)}%`;
}

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function markdown(results: CommitResult[], jev: { calls: number; questions: number; inputTokens: number }, executed: boolean): string {
  const totalTests = sum(results.map((r) => r.total));
  const failing = sum(results.map((r) => r.newlyFailing.length));
  const regressions = results.filter((r) => r.newlyFailing.length > 0).length;
  const label: Record<Policy, string> = {
    naive: 'Deterministic only, unmapped e2e skipped (unsafe)',
    safe: 'Deterministic only, unmapped e2e all run',
    jev: 'Deterministic + Jev (this project)',
  };
  const rows = [
    `| Full suite | ${totalTests} | 0% | ${secs(sum(results.map((r) => r.fullTestMs)))} | ${executed ? secs(sum(results.map((r) => r.fullWallMs))) : 'n/a'} | 0 of ${failing} | ${regressions} of ${regressions} |`,
    ...policies.map((policy) => {
      const selected = sum(results.map((r) => r.policies[policy].selected));
      const missed = sum(results.map((r) => r.policies[policy].missed.length));
      const caught = results.filter((r) => r.newlyFailing.length > 0 && r.policies[policy].missed.length < r.newlyFailing.length).length;
      const testMs = sum(results.map((r) => r.policies[policy].testMs));
      const wall = executed ? secs(sum(results.map((r) => r.policies[policy].wallMs ?? 0))) : 'n/a';
      return `| ${label[policy]} | ${selected} | ${pct(totalTests - selected, totalTests)} | ${secs(testMs)} | ${wall} | ${missed} of ${failing} | ${caught} of ${regressions} |`;
    }),
  ];
  const perCommit = results.map((r) => {
    const j = r.policies.jev;
    const missed = j.missed.length > 0 ? `**${j.missed.length}**` : '0';
    return `| \`${r.sha.slice(0, 7)}\` ${r.subject} | ${r.changed.join(', ')} | ${j.mode === 'full' ? `all ${r.total} (full)` : `${j.selected}/${r.total}`} | ${r.newlyFailing.length} | ${missed} |`;
  });
  return [
    `# Replay benchmark`,
    '',
    `${results.length} commits of the demo app replayed. For every commit the full suite was run once to learn which tests really broke, then each policy picked its tests from the diff alone.`,
    '',
    '| Policy | Tests run | Skipped | Test time (sum of per-test durations) | Measured wall-clock | Newly failing tests missed | Regressing commits caught |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Jev usage for the whole replay: ${jev.calls} calls, ${jev.questions} questions, ${jev.inputTokens.toLocaleString('en-US')} input tokens (about $${((jev.inputTokens / 1e6) * PRICE_PER_MILLION_INPUT).toFixed(4)} at $${PRICE_PER_MILLION_INPUT}/M input tokens).`,
    '',
    '## Failures that only Jev caught',
    '',
    'These broken tests were not reachable by the import graph, an owner rule or the smoke tag. Jev had to flag them, and the probability shows how far above the threshold it was.',
    '',
    '| Commit | Test | Jev probability |',
    '| --- | --- | --- |',
    ...results.flatMap((r) => r.caughtOnlyByJev.map((c) => `| \`${r.sha.slice(0, 7)}\` | ${c.id.split('::')[1]} | ${c.probability.toFixed(2)} |`)),
    '',
    '## Per commit (Deterministic + Jev)',
    '',
    '| Commit | Changed files | Tests selected | Newly failing | Missed |',
    '| --- | --- | --- | --- | --- |',
    ...perCommit,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { execute: { type: 'boolean' }, check: { type: 'boolean' } } });
  const truth = JSON.parse(readFileSync(join(repoRoot, 'bench', 'ground-truth.json'), 'utf8')) as TruthCommit[];
  const work = join(repoRoot, '.jti-work', 'replay');
  const commits = buildHistory(work);
  const fixturesDir = join(repoRoot, 'fixtures', 'jev');
  const results: CommitResult[] = [];
  const jevTotals = { calls: 0, questions: 0, inputTokens: 0 };

  for (let index = 1; index < commits.length; index++) {
    const commit = commits[index]!;
    const parent = commits[index - 1]!;
    const facts = truth.find((entry) => entry.sha === commit.sha);
    const before = truth.find((entry) => entry.sha === parent.sha);
    if (!facts || !before) {
      throw new Error(`ground truth is stale for ${commit.sha.slice(0, 7)} ${commit.subject}; run npm run bench:truth`);
    }
    git(work, ['checkout', '-q', commit.sha]);
    const newlyFailing = Object.entries(facts.outcomes)
      .filter(([id, outcome]) => !outcome.passed && before.outcomes[id]?.passed !== false)
      .map(([id]) => id);
    const duration = (id: string) => facts.outcomes[id]?.durationMs ?? 0;
    const allIds = Object.keys(facts.outcomes);
    const entry: CommitResult = {
      sha: commit.sha,
      subject: commit.subject,
      changed: [],
      total: allIds.length,
      newlyFailing,
      policies: {} as CommitResult['policies'],
      caughtOnlyByJev: [],
      fullTestMs: sum(allIds.map(duration)),
      fullWallMs: facts.wallMs.unit + facts.wallMs.e2e,
    };
    for (const policy of policies) {
      const { selection, changes } = await analyze({ root: work, base: parent.sha, head: commit.sha, policy, fixturesDir });
      entry.changed = changes.map((change) => change.path);
      const ids = selectedIds(selection);
      const unknown = [...ids].filter((id) => !(id in facts.outcomes));
      if (unknown.length > 0) {
        throw new Error(`inventory and runner disagree on test ids: ${unknown.join(', ')}`);
      }
      if (policy === 'jev' && selection.mode === 'partial') {
        for (const { test, reasons } of selection.selected) {
          const jev = reasons.find((reason) => reason.kind === 'jev');
          if (newlyFailing.includes(test.id) && jev?.kind === 'jev' && reasons.length === 1) {
            entry.caughtOnlyByJev.push({ id: test.id, probability: jev.probability });
          }
        }
      }
      if (policy === 'jev') {
        jevTotals.calls += selection.jev.calls;
        jevTotals.questions += selection.jev.questions;
        jevTotals.inputTokens += selection.jev.inputTokens;
      }
      entry.policies[policy] = {
        mode: selection.mode,
        selected: ids.size,
        missed: newlyFailing.filter((id) => !ids.has(id)),
        testMs: sum([...ids].map(duration)),
        ...(selection.mode === 'full' ? { why: selection.why } : {}),
        ...(values.execute ? { wallMs: executeSelection(work, selection) } : {}),
      };
    }
    const j = entry.policies.jev;
    console.log(`${commit.sha.slice(0, 7)} ${commit.subject}: jev ${j.selected}/${entry.total}, failing ${newlyFailing.length}, missed ${j.missed.length}${j.why ? ` (${j.why})` : ''}`);
    results.push(entry);
  }

  const outPath = join(repoRoot, 'bench', 'results.json');
  const summary = results.map(({ sha, subject, newlyFailing, policies: p }) => ({
    sha,
    subject,
    newlyFailing,
    selected: Object.fromEntries(policies.map((policy) => [policy, { selected: p[policy].selected, missed: p[policy].missed }])),
  }));
  if (values.check) {
    const committed = JSON.parse(readFileSync(outPath, 'utf8')) as { summary: unknown };
    if (JSON.stringify(committed.summary) !== JSON.stringify(summary)) {
      console.error('Replay no longer matches bench/results.json');
      process.exit(1);
    }
    const missed = sum(results.map((r) => r.policies.jev.missed.length));
    if (missed > 0) {
      console.error(`Jev policy missed ${missed} failing tests`);
      process.exit(1);
    }
    console.log('Replay matches the committed results and missed no failing test.');
    return;
  }
  writeFileSync(outPath, `${JSON.stringify({ summary, results, jev: jevTotals }, null, 2)}\n`);
  writeFileSync(join(repoRoot, 'bench', 'RESULTS.md'), markdown(results, jevTotals, Boolean(values.execute)));
  console.log(readFileSync(join(repoRoot, 'bench', 'RESULTS.md'), 'utf8'));
}

await main();
