import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import ts from 'typescript';
import { toPosix } from './files.js';

const candidates = (base: string): string[] => {
  const withoutJs = base.replace(/\.(m|c)?js$/, '');
  return [base, `${withoutJs}.ts`, `${withoutJs}.tsx`, `${withoutJs}.mts`, `${base}.ts`, `${base}/index.ts`, `${base}.json`];
};

export class ImportGraph {
  private readonly direct = new Map<string, string[]>();
  private readonly closures = new Map<string, Set<string>>();

  constructor(private readonly root: string) {}

  private resolve(from: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) {
      return undefined;
    }
    const base = toPosix(normalize(join(dirname(from), specifier)));
    return candidates(base).find((candidate) => existsSync(join(this.root, candidate)));
  }

  imports(file: string): string[] {
    const cached = this.direct.get(file);
    if (cached) {
      return cached;
    }
    let resolved: string[] = [];
    if (/\.(m|c)?tsx?$/.test(file) && existsSync(join(this.root, file))) {
      const info = ts.preProcessFile(readFileSync(join(this.root, file), 'utf8'), true, true);
      resolved = info.importedFiles
        .map((ref) => this.resolve(file, ref.fileName))
        .filter((path): path is string => path !== undefined);
    }
    this.direct.set(file, resolved);
    return resolved;
  }

  closure(file: string): Set<string> {
    const cached = this.closures.get(file);
    if (cached) {
      return cached;
    }
    const seen = new Set<string>([file]);
    const queue = [file];
    while (queue.length > 0) {
      for (const next of this.imports(queue.shift()!)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    this.closures.set(file, seen);
    return seen;
  }
}
