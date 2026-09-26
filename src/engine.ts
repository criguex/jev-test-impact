import { join } from 'node:path';
import { loadConfig } from './config.js';
import { changedFiles } from './git.js';
import { ImportGraph } from './graph.js';
import { discoverTests } from './inventory.js';
import { endpointFromEnv, HttpTransport } from './jev/client.js';
import { FixtureTransport, type FixtureMode } from './jev/fixtures.js';
import { ConstantJudge, JevJudge, type AmbiguityJudge } from './jev/judge.js';
import { selectTests } from './select.js';
import type { FileChange, ImpactConfig, Selection } from './types.js';

export type Policy = 'jev' | 'safe' | 'naive';

export interface AnalyzeOptions {
  root: string;
  base: string;
  head: string;
  policy?: Policy;
  fixturesDir?: string;
  fixtureMode?: FixtureMode;
}

export interface Analysis {
  config: ImpactConfig;
  changes: FileChange[];
  selection: Selection;
}

export function buildJudge(policy: Policy, config: ImpactConfig, fixturesDir: string, mode: FixtureMode): { judge: AmbiguityJudge; fixtures?: FixtureTransport } {
  if (policy === 'safe') {
    return { judge: new ConstantJudge('select-all', 1) };
  }
  if (policy === 'naive') {
    return { judge: new ConstantJudge('select-none', 0) };
  }
  const endpoint = endpointFromEnv();
  const fixtures = new FixtureTransport(fixturesDir, mode, endpoint ? new HttpTransport(endpoint) : undefined);
  return { judge: new JevJudge(fixtures, config.jev.maxQuestionsPerCall), fixtures };
}

export async function analyze(options: AnalyzeOptions): Promise<Analysis> {
  const config = loadConfig(options.root);
  const changes = changedFiles(options.root, options.base, options.head);
  const tests = discoverTests(options.root, config);
  const fixturesDir = options.fixturesDir ?? join(options.root, '.jti', 'fixtures');
  const mode = options.fixtureMode ?? (process.env.JTI_JEV_MODE as FixtureMode | undefined) ?? 'auto';
  const { judge, fixtures } = buildJudge(options.policy ?? 'jev', config, fixturesDir, mode);
  const selection = await selectTests({ changes, tests, config, graph: new ImportGraph(options.root), judge });
  selection.jev.fromFixtures = fixtures?.hits ?? 0;
  return { config, changes, selection };
}
