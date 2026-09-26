import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { planSuite, shellQuote } from './args.js';
import { analyze, type Policy } from './engine.js';
import { mergeBase } from './git.js';
import { markdownSummary } from './report.js';

const usage = `jti — run only the tests your change touched

Usage:
  jti select [--root dir] [--base ref] [--head ref] [--format summary|json|github]
  jti run --suite <name> [--root dir] [--base ref] [--head ref] -- <test command...>

Options:
  --root     project directory holding impact.config.json (default: .)
  --base     compare against this ref; its merge-base with head is used (default: origin/main)
  --head     ref under test (default: HEAD)
  --policy   jev | safe | naive (default: jev)
  --fixtures directory of recorded Jev answers (default: <root>/.jti/fixtures)

Env: AI_GATEWAY_API_KEY or TYPESAFE_API_KEY enables live Jev; JTI_JEV_MODE=auto|replay|record|live.
If Jev cannot answer, every test runs.`;

async function main(argv: string[]): Promise<number> {
  const separator = argv.indexOf('--');
  const command = separator >= 0 ? argv.slice(separator + 1) : [];
  const { positionals, values } = parseArgs({
    args: separator >= 0 ? argv.slice(0, separator) : argv,
    allowPositionals: true,
    options: {
      root: { type: 'string', default: '.' },
      base: { type: 'string', default: 'origin/main' },
      head: { type: 'string', default: 'HEAD' },
      format: { type: 'string', default: 'summary' },
      suite: { type: 'string' },
      policy: { type: 'string', default: 'jev' },
      fixtures: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const action = positionals[0];
  if (values.help || !action) {
    console.log(usage);
    return action ? 0 : 1;
  }
  const root = resolve(values.root);
  const base = mergeBase(root, values.base, values.head);
  const { config, selection } = await analyze({
    root,
    base,
    head: values.head,
    policy: values.policy as Policy,
    fixturesDir: values.fixtures ? resolve(values.fixtures) : undefined,
  });

  if (action === 'select') {
    if (values.format === 'json') {
      console.log(JSON.stringify(selection, null, 2));
    } else if (values.format === 'github') {
      const lines = [`mode=${selection.mode}`];
      for (const suite of config.suites) {
        const plan = planSuite(selection, suite.name);
        lines.push(`${suite.name}=${plan.action}`);
        lines.push(`${suite.name}_args=${plan.action === 'some' ? plan.args.map(shellQuote).join(' ') : ''}`);
      }
      const output = process.env.GITHUB_OUTPUT;
      output ? appendFileSync(output, `${lines.join('\n')}\n`) : console.log(lines.join('\n'));
      const summary = process.env.GITHUB_STEP_SUMMARY;
      summary ? appendFileSync(summary, markdownSummary(selection)) : console.log(markdownSummary(selection));
    } else {
      console.log(markdownSummary(selection));
    }
    return 0;
  }

  if (action === 'run') {
    const suite = config.suites.find((candidate) => candidate.name === values.suite);
    if (!suite || command.length === 0) {
      console.error(`run needs --suite (${config.suites.map((s) => s.name).join(', ')}) and a command after --`);
      return 2;
    }
    const plan = planSuite(selection, suite.name);
    if (plan.action === 'skip') {
      console.log(`[jti] no ${suite.name} test is affected by this change; skipping.`);
      return 0;
    }
    const [program, ...rest] = command as [string, ...string[]];
    const args = plan.action === 'some' ? [...rest, ...plan.args] : rest;
    const why = selection.mode === 'full' ? selection.why : `${plan.action === 'some' ? plan.tests.length : 'all'} selected`;
    console.log(`[jti] ${suite.name}: ${why}\n[jti] ${[program, ...args].map(shellQuote).join(' ')}`);
    const result = spawnSync(program, args, { cwd: root, stdio: 'inherit' });
    return result.status ?? 1;
  }

  console.error(usage);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`[jti] ${(error as Error).message}`);
    process.exit(2);
  },
);
