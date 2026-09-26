import type { FileChange, Hunk } from './types.js';

function stripPrefix(path: string): string {
  return path.replace(/^[ab]\//, '');
}

export function parseUnifiedDiff(text: string): FileChange[] {
  const changes: FileChange[] = [];
  let current: FileChange | undefined;
  let hunk: Hunk | undefined;

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      current = { path: match?.[2] ?? '', status: 'modified', binary: false, hunks: [] };
      hunk = undefined;
      changes.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    if (hunk) {
      if (line.startsWith('+')) {
        hunk.added.push(line.slice(1));
        continue;
      }
      if (line.startsWith('-')) {
        hunk.removed.push(line.slice(1));
        continue;
      }
      if (line.startsWith(' ') || line.startsWith('\\')) {
        continue;
      }
    }
    if (line.startsWith('@@')) {
      hunk = { header: line, removed: [], added: [] };
      current.hunks.push(hunk);
    } else if (line.startsWith('new file mode')) {
      current.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      current.status = 'renamed';
      current.previousPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      current.path = line.slice('rename to '.length);
    } else if (line.startsWith('Binary files ')) {
      current.binary = true;
    } else if (line.startsWith('+++ ') && !line.endsWith('/dev/null')) {
      current.path = stripPrefix(line.slice(4));
    } else if (line.startsWith('--- ') && current.status === 'deleted' && !line.endsWith('/dev/null')) {
      current.path = stripPrefix(line.slice(4));
    }
  }
  return changes;
}
