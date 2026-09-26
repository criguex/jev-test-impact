import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildHistory, git, repoRoot } from './history.js';

interface Outcome {
  passed: boolean;
  durationMs: number;
}

export interface TruthCommit {
  sha: string;
  subject: string;
  outcomes: Record<string, Outcome>;
  wallMs: { unit: number; e2e: number };
}

interface VitestReport {
  testResults: { name: string; assertionResults: { ancestorTitles: string[]; title: string; status: string; duration?: number }[] }[];
}

interface PwSpec {
  title: string;
  file: string;
  tests: { status: string; results: { duration: number }[] }[];
}

interface PwSuite {
  title: string;
  file: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

function run(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): number {
  const started = performance.now();
  try {
    execFileSync('npx', args, { cwd, stdio: 'ignore', env: { ...process.env, ...env } });
  } catch {
    return performance.now() - started;
  }
  return performance.now() - started;
}

function vitestOutcomes(dir: string, reportPath: string): Record<string, Outcome> {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as VitestReport;
  const out: Record<string, Outcome> = {};
  for (const file of report.testResults) {
    const rel = relative(dir, file.name);
    for (const result of file.assertionResults) {
      out[`${rel}::${[...result.ancestorTitles, result.title].join(' > ')}`] = {
        passed: result.status === 'passed',
        durationMs: Math.round(result.duration ?? 0),
      };
    }
  }
  return out;
}

function playwrightOutcomes(reportPath: string, testDir: string): Record<string, Outcome> {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { suites: PwSuite[] };
  const out: Record<string, Outcome> = {};
  const walk = (suite: PwSuite, path: string[]): void => {
    for (const spec of suite.specs ?? []) {
      const test = spec.tests[0]!;
      out[`${testDir}/${spec.file}::${[...path, spec.title].join(' > ')}`] = {
        passed: test.status === 'expected',
        durationMs: Math.round(test.results.reduce((sum, result) => sum + result.duration, 0)),
      };
    }
    for (const child of suite.suites ?? []) {
      walk(child, [...path, child.title]);
    }
  };
  report.suites.forEach((suite) => walk(suite, []));
  return out;
}

export function measure(dir: string, reports: string): Omit<TruthCommit, 'sha' | 'subject'> {
  mkdirSync(reports, { recursive: true });
  const unitReport = join(reports, 'unit.json');
  const e2eReport = join(reports, 'e2e.json');
  const unit = run(dir, ['vitest', 'run', '--config', 'vitest.config.ts', '--reporter=json', `--outputFile=${unitReport}`]);
  const e2e = run(dir, ['playwright', 'test', '--config', 'playwright.config.ts', '--reporter=json', '--retries=0'], {
    PLAYWRIGHT_JSON_OUTPUT_NAME: e2eReport,
    DEMO_PORT: '4391',
  });
  return {
    outcomes: { ...vitestOutcomes(dir, unitReport), ...playwrightOutcomes(e2eReport, 'tests/e2e') },
    wallMs: { unit: Math.round(unit), e2e: Math.round(e2e) },
  };
}

if (import.meta.main ?? process.argv[1]?.endsWith('truth.ts')) {
  const work = join(repoRoot, '.jti-work', 'truth');
  const commits = buildHistory(work);
  const truth: TruthCommit[] = [];
  for (const commit of commits) {
    git(work, ['checkout', '-q', commit.sha]);
    const measured = measure(work, join(repoRoot, '.jti-work', 'reports'));
    const failing = Object.entries(measured.outcomes).filter(([, outcome]) => !outcome.passed).map(([id]) => id);
    console.log(`${commit.sha.slice(0, 7)} ${commit.subject}: ${Object.keys(measured.outcomes).length} tests, ${failing.length} failing`);
    failing.forEach((id) => console.log(`    ✗ ${id}`));
    truth.push({ ...commit, ...measured });
  }
  writeFileSync(join(repoRoot, 'bench', 'ground-truth.json'), `${JSON.stringify(truth, null, 2)}\n`);
}
