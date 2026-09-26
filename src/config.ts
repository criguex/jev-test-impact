import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImpactConfig } from './types.js';

const defaults: ImpactConfig = {
  suites: [],
  alwaysRun: [],
  fullSuiteOn: ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'impact.config.json'],
  ignore: ['**/*.md'],
  owners: [],
  jev: { threshold: 0.2, maxQuestionsPerCall: 40 },
};

export function parseConfig(raw: unknown): ImpactConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('impact config must be a JSON object');
  }
  const config = { ...defaults, ...(raw as Partial<ImpactConfig>) };
  config.jev = { ...defaults.jev, ...(raw as Partial<ImpactConfig>).jev };
  if (config.suites.length === 0) {
    throw new Error('impact config needs at least one suite');
  }
  for (const suite of config.suites) {
    if (!['vitest', 'playwright'].includes(suite.runner)) {
      throw new Error(`suite ${suite.name}: unsupported runner ${suite.runner}`);
    }
    if (!['import-graph', 'black-box'].includes(suite.strategy)) {
      throw new Error(`suite ${suite.name}: unsupported strategy ${suite.strategy}`);
    }
  }
  if (config.jev.threshold <= 0 || config.jev.threshold >= 1) {
    throw new Error('jev.threshold must be between 0 and 1');
  }
  return config;
}

export function loadConfig(root: string, file = 'impact.config.json'): ImpactConfig {
  return parseConfig(JSON.parse(readFileSync(join(root, file), 'utf8')));
}
