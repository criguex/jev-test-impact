import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../src/diff.js';

const sample = `diff --git a/src/pricing.ts b/src/pricing.ts
index 1..2 100644
--- a/src/pricing.ts
+++ b/src/pricing.ts
@@ -10,3 +10,3 @@ const rules
-  WELCOME10: 10,
+  WELCOME10: 15,
   BULK5: 5,
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1 @@
+export const x = 1;
diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
--- a/src/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const y = 2;
diff --git a/src/old.ts b/src/renamed.ts
similarity index 90%
rename from src/old.ts
rename to src/renamed.ts
diff --git a/logo.png b/logo.png
Binary files a/logo.png and b/logo.png differ
`;

describe('parseUnifiedDiff', () => {
  const changes = parseUnifiedDiff(sample);

  it('reads modified files with their hunks', () => {
    expect(changes[0]).toEqual({
      path: 'src/pricing.ts',
      status: 'modified',
      binary: false,
      hunks: [{ header: '@@ -10,3 +10,3 @@ const rules', removed: ['  WELCOME10: 10,'], added: ['  WELCOME10: 15,'] }],
    });
  });

  it('marks added and deleted files', () => {
    expect(changes[1]).toMatchObject({ path: 'src/new.ts', status: 'added' });
    expect(changes[2]).toMatchObject({ path: 'src/gone.ts', status: 'deleted', hunks: [{ removed: ['export const y = 2;'] }] });
  });

  it('keeps both sides of a rename', () => {
    expect(changes[3]).toMatchObject({ path: 'src/renamed.ts', previousPath: 'src/old.ts', status: 'renamed', hunks: [] });
  });

  it('flags binary files', () => {
    expect(changes[4]).toMatchObject({ path: 'logo.png', binary: true });
  });

  it('returns nothing for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});
