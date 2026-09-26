export type Runner = 'vitest' | 'playwright';
export type Strategy = 'import-graph' | 'black-box';

export interface SuiteConfig {
  name: string;
  runner: Runner;
  include: string[];
  strategy: Strategy;
}

export interface OwnerRule {
  files: string[];
  tags: string[];
}

export interface ImpactConfig {
  suites: SuiteConfig[];
  alwaysRun: string[];
  fullSuiteOn: string[];
  ignore: string[];
  owners: OwnerRule[];
  jev: { threshold: number; maxQuestionsPerCall: number };
}

export interface TestCase {
  id: string;
  suite: string;
  runner: Runner;
  strategy: Strategy;
  file: string;
  line: number;
  titlePath: string[];
  tags: string[];
  steps: string;
}

export interface Hunk {
  header: string;
  removed: string[];
  added: string[];
}

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface FileChange {
  path: string;
  previousPath?: string;
  status: ChangeStatus;
  binary: boolean;
  hunks: Hunk[];
}

export type Reason =
  | { kind: 'test-file-changed'; file: string }
  | { kind: 'import-graph'; file: string }
  | { kind: 'owner'; file: string; tag: string }
  | { kind: 'always-run'; tag: string }
  | { kind: 'jev'; file: string; probability: number }
  | { kind: 'unreadable-change'; file: string };

export interface SelectedTest {
  test: TestCase;
  reasons: Reason[];
}

export interface JevUsage {
  calls: number;
  questions: number;
  inputTokens: number;
  fromFixtures: number;
}

export type Selection =
  | { mode: 'full'; why: string; tests: TestCase[]; jev: JevUsage }
  | { mode: 'partial'; selected: SelectedTest[]; skipped: TestCase[]; jev: JevUsage };
