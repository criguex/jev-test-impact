import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { listFiles } from './files.js';
import { matchesAny } from './glob.js';
import type { ImpactConfig, SuiteConfig, TestCase } from './types.js';

const groupNames = new Set(['describe', 'test.describe', 'describe.only', 'describe.skip', 'test.describe.only', 'test.describe.serial', 'test.describe.parallel']);
const testNames = new Set(['it', 'test', 'it.only', 'test.only', 'it.concurrent', 'test.concurrent', 'test.fixme', 'test.fail', 'test.slow']);
const MAX_STEPS = 1500;

function calleeName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const left = calleeName(expression.expression);
    return left ? `${left}.${expression.name.text}` : undefined;
  }
  return undefined;
}

function titleOf(node: ts.Expression | undefined): string | undefined {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text;
  }
  return undefined;
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function topLevelHelpers(source: ts.SourceFile): Map<string, string> {
  const helpers = new Map<string, string>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      helpers.set(statement.name.text, statement.getText(source));
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
          helpers.set(declaration.name.text, statement.getText(source));
        }
      }
    }
  }
  return helpers;
}

function describeSteps(body: string, helpers: Map<string, string>): string {
  const used = [...helpers].filter(([name]) => new RegExp(`\\b${name}\\(`).test(body)).map(([, text]) => text);
  return squash([body, ...used].join('\n')).slice(0, MAX_STEPS);
}

export function parseTestFile(file: string, text: string, suite: SuiteConfig): TestCase[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const helpers = topLevelHelpers(source);
  const tests: TestCase[] = [];

  const visit = (node: ts.Node, path: string[]): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      const title = titleOf(node.arguments[0]);
      if (name && title !== undefined && groupNames.has(name)) {
        node.arguments.slice(1).forEach((argument) => visit(argument, [...path, title]));
        return;
      }
      if (name && title !== undefined && testNames.has(name)) {
        const callback = node.arguments.at(-1);
        const titlePath = [...path, title];
        tests.push({
          id: `${file}::${titlePath.join(' > ')}`,
          suite: suite.name,
          runner: suite.runner,
          strategy: suite.strategy,
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          titlePath,
          tags: [...new Set(titlePath.join(' ').match(/@[\w-]+/g) ?? [])],
          steps: describeSteps(callback ? callback.getText(source) : '', helpers),
        });
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, path));
  };

  visit(source, []);
  return tests;
}

export function discoverTests(root: string, config: ImpactConfig, files = listFiles(root)): TestCase[] {
  return config.suites.flatMap((suite) =>
    files
      .filter((file) => matchesAny(file, suite.include))
      .flatMap((file) => parseTestFile(file, readFileSync(join(root, file), 'utf8'), suite)),
  );
}
