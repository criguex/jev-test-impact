import type { Reason, Selection } from './types.js';

export function describeReason(reason: Reason): string {
  switch (reason.kind) {
    case 'test-file-changed':
      return 'test file changed';
    case 'import-graph':
      return `imports ${reason.file}`;
    case 'owner':
      return `${reason.tag} owns ${reason.file}`;
    case 'always-run':
      return `always runs (${reason.tag})`;
    case 'jev':
      return `Jev p=${reason.probability.toFixed(2)} for ${reason.file}`;
    case 'unreadable-change':
      return `cannot read diff of ${reason.file}`;
  }
}

export function markdownSummary(selection: Selection): string {
  if (selection.mode === 'full') {
    return `### Test impact: full suite\n\n${selection.tests.length} tests. Reason: ${selection.why}\n`;
  }
  const total = selection.selected.length + selection.skipped.length;
  const rows = selection.selected
    .map(({ test, reasons }) => `| \`${test.suite}\` | ${test.titlePath.join(' › ')} | ${reasons.map(describeReason).join('; ')} |`)
    .join('\n');
  return [
    `### Test impact: ${selection.selected.length} of ${total} tests selected`,
    '',
    `Jev: ${selection.jev.questions} questions in ${selection.jev.calls} calls (${selection.jev.fromFixtures} from recorded fixtures).`,
    '',
    '| Suite | Test | Why |',
    '| --- | --- | --- |',
    rows,
    '',
  ].join('\n');
}
