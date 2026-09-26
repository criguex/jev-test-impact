import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ImportGraph } from '../src/graph.js';

const graph = new ImportGraph(fileURLToPath(new URL('../demo', import.meta.url)));

describe('ImportGraph', () => {
  it('resolves JSON imports and .js specifiers, type-only imports included', () => {
    expect(graph.imports('src/catalog.ts')).toEqual(['src/catalog.json', 'src/money.ts']);
  });

  it('follows imports transitively', () => {
    const closure = graph.closure('tests/unit/cart.test.ts');
    expect(closure).toContain('src/pricing.ts');
    expect(closure).toContain('src/money.ts');
    expect(closure).toContain('src/catalog.json');
    expect(closure).not.toContain('src/auth.ts');
  });

  it('ignores package imports', () => {
    expect(graph.imports('tests/unit/money.test.ts')).toEqual(['src/money.ts']);
  });

  it('has no edges from a non-code file', () => {
    expect(graph.imports('public/styles.css')).toEqual([]);
  });
});
