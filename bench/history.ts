import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..');
export const patchesDir = join(repoRoot, 'bench', 'history');

export interface Commit {
  sha: string;
  subject: string;
}

const identity = {
  GIT_AUTHOR_NAME: 'Demo Dev',
  GIT_AUTHOR_EMAIL: 'dev@example.com',
  GIT_COMMITTER_NAME: 'Demo Dev',
  GIT_COMMITTER_EMAIL: 'dev@example.com',
  GIT_AUTHOR_DATE: '2026-09-01T09:00:00Z',
  GIT_COMMITTER_DATE: '2026-09-01T09:00:00Z',
};

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...identity } });
}

export function buildHistory(workDir: string, withPatches = true): Commit[] {
  rmSync(workDir, { recursive: true, force: true });
  cpSync(join(repoRoot, 'demo'), workDir, {
    recursive: true,
    filter: (source) => !/(test-results|playwright-report|node_modules)/.test(source),
  });
  git(workDir, ['init', '-q', '-b', 'main']);
  git(workDir, ['add', '-A']);
  git(workDir, ['commit', '-q', '-m', 'Baseline: Paper Lantern Books']);
  if (withPatches) {
    const patches = readdirSync(patchesDir).filter((name) => name.endsWith('.patch')).sort();
    if (patches.length > 0) {
      git(workDir, ['am', '-q', '--committer-date-is-author-date', ...patches.map((name) => join(patchesDir, name))]);
    }
  }
  if (!existsSync(join(workDir, 'node_modules'))) {
    symlinkSync(join(repoRoot, 'node_modules'), join(workDir, 'node_modules'), 'dir');
  }
  return git(workDir, ['log', '--reverse', '--format=%H%x09%s'])
    .trim()
    .split('\n')
    .map((line) => {
      const [sha, subject] = line.split('\t') as [string, string];
      return { sha, subject };
    });
}
