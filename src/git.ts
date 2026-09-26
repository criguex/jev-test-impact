import { execFileSync } from 'node:child_process';
import { parseUnifiedDiff } from './diff.js';
import type { FileChange } from './types.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function mergeBase(root: string, base: string, head: string): string {
  return git(root, ['merge-base', base, head]).trim();
}

export function changedFiles(root: string, base: string, head: string): FileChange[] {
  const text = git(root, ['diff', '--no-color', '--no-ext-diff', '--relative', '-M', '--unified=3', base, head, '--', '.']);
  return parseUnifiedDiff(text);
}
