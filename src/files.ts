import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const skipped = new Set(['node_modules', '.git', 'test-results', 'playwright-report', 'dist', 'coverage']);

export function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skipped.has(entry.name)) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(toPosix(relative(root, full)));
      }
    }
  };
  walk(root);
  return out.sort();
}
