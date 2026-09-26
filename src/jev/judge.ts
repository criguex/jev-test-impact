import type { FileChange, TestCase } from '../types.js';
import { MODEL, type JevRequest, type JevTransport, type NoulQuestion } from './client.js';

export interface Verdicts {
  probabilities: Map<string, number>;
  calls: number;
  questions: number;
  inputTokens: number;
}

export interface AmbiguityJudge {
  readonly name: string;
  judge(change: FileChange, candidates: TestCase[]): Promise<Verdicts>;
}

const MAX_LINES_PER_SIDE = 40;
const MAX_HUNKS = 8;

export const QUESTION =
  'Could the code change described in the state alter what `test` does or observes, so that its result (pass or fail) might be different?';

export const CRITERIA = {
  true: 'The change touches code, markup, data, styles, routes or behavior that `test` exercises directly or indirectly, including shared pages, components, helpers, prices or text it asserts on.',
  false: 'Nothing that `test` visits, clicks, reads or asserts on can be influenced by the change.',
};

export function describeChange(change: FileChange): Record<string, unknown> {
  return {
    file: change.path,
    ...(change.previousPath ? { renamed_from: change.previousPath } : {}),
    status: change.status,
    hunks: change.hunks.slice(0, MAX_HUNKS).map((hunk) => ({
      location: hunk.header,
      removed: hunk.removed.slice(0, MAX_LINES_PER_SIDE),
      added: hunk.added.slice(0, MAX_LINES_PER_SIDE),
    })),
  };
}

export function question(test: TestCase): NoulQuestion {
  return {
    type: 'noul',
    instructions: {
      test: { file: test.file, title: test.titlePath.join(' > '), steps: test.steps },
      question: QUESTION,
    },
    criteria: CRITERIA,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export class JevJudge implements AmbiguityJudge {
  readonly name = 'jev';

  constructor(
    private readonly transport: JevTransport,
    private readonly maxQuestionsPerCall: number,
  ) {}

  async judge(change: FileChange, candidates: TestCase[]): Promise<Verdicts> {
    const state = describeChange(change);
    const batches = chunk(candidates, this.maxQuestionsPerCall);
    const results = await Promise.all(
      batches.map(async (batch) => {
        const request: JevRequest = {
          model: MODEL,
          state,
          questions: Object.fromEntries(batch.map((test, index) => [`t${index}`, question(test)])),
        };
        const response = await this.transport.send(request);
        return { batch, response };
      }),
    );
    const probabilities = new Map<string, number>();
    let inputTokens = 0;
    for (const { batch, response } of results) {
      inputTokens += response.inputTokens;
      batch.forEach((test, index) => {
        const probability = response.probabilities[`t${index}`];
        if (probability === undefined) {
          throw new Error(`Jev returned no answer for ${test.id}`);
        }
        probabilities.set(test.id, probability);
      });
    }
    return { probabilities, calls: batches.length, questions: candidates.length, inputTokens };
  }
}

export class ConstantJudge implements AmbiguityJudge {
  constructor(
    readonly name: string,
    private readonly probability: number,
  ) {}

  async judge(_change: FileChange, candidates: TestCase[]): Promise<Verdicts> {
    return {
      probabilities: new Map(candidates.map((test) => [test.id, this.probability])),
      calls: 0,
      questions: 0,
      inputTokens: 0,
    };
  }
}
