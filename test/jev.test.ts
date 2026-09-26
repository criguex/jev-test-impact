import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { endpointFromEnv, HttpTransport, JevError, normalizeAnswers, type JevRequest, type JevTransport } from '../src/jev/client.js';
import { FixtureTransport } from '../src/jev/fixtures.js';
import { describeChange, JevJudge, question } from '../src/jev/judge.js';
import { testCase } from './helpers.js';

const endpoint = { url: 'https://example.test/v1/systemone', key: 'k', via: 'test' };
const request: JevRequest = { model: 'jev-latest', state: 'diff', questions: { t0: { type: 'noul', instructions: 'q?' } } };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

describe('normalizeAnswers', () => {
  it('accepts the native noul field', () => {
    expect(normalizeAnswers({ answers: { t0: { type: 'noul', noul: 0.8 } } })).toEqual({ t0: 0.8 });
  });

  it('accepts the gateway boolean/probability shape', () => {
    expect(normalizeAnswers({ answers: { a: { type: 'boolean', probability: 0.3 }, b: { type: 'boolean', boolean: true } } })).toEqual({ a: 0.3, b: 1 });
  });

  it('rejects missing or out-of-range values', () => {
    expect(() => normalizeAnswers({})).toThrow(JevError);
    expect(() => normalizeAnswers({ answers: { t0: { noul: 1.4 } } })).toThrow(/not a probability/);
  });
});

describe('endpointFromEnv', () => {
  it('prefers the direct TypeSafe key, then the gateway key', () => {
    expect(endpointFromEnv({ TYPESAFE_API_KEY: 'a', AI_GATEWAY_API_KEY: 'b' })?.via).toBe('typesafe');
    expect(endpointFromEnv({ AI_GATEWAY_API_KEY: 'b' })?.url).toContain('ai-gateway.vercel.sh/typesafe');
    expect(endpointFromEnv({})).toBeUndefined();
  });
});

describe('HttpTransport', () => {
  it('sends the key and returns probabilities with token usage', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => json(200, { model: 'jev-1.13.0', answers: { t0: { type: 'noul', noul: 0.7 } }, usage: { input_tokens: 42 } }));
    const response = await new HttpTransport(endpoint, fetchImpl as typeof fetch, 0).send(request);
    expect(response).toEqual({ model: 'jev-1.13.0 via test', probabilities: { t0: 0.7 }, inputTokens: 42 });
    expect(fetchImpl.mock.calls[0]![1].headers).toMatchObject({ authorization: 'Bearer k' });
  });

  it('retries rate limits before giving up', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(429, 'busy'))
      .mockResolvedValueOnce(json(200, { answers: { t0: { noul: 0.1 } } }));
    const response = await new HttpTransport(endpoint, fetchImpl as typeof fetch, 1, 1).send(request);
    expect(response.probabilities).toEqual({ t0: 0.1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('puts the response body in the error', async () => {
    const fetchImpl = vi.fn(async () => json(400, '{"error":"bad question"}'));
    await expect(new HttpTransport(endpoint, fetchImpl as typeof fetch, 0).send(request)).rejects.toThrow('400 via test: {"error":"bad question"}');
  });
});

describe('FixtureTransport', () => {
  const live: JevTransport = { send: async () => ({ model: 'm', probabilities: { t0: 0.6 }, inputTokens: 10 }) };

  it('records live answers and replays them offline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jti-'));
    await new FixtureTransport(dir, 'record', live).send(request);
    expect(readdirSync(dir)).toHaveLength(1);
    const offline = new FixtureTransport(dir, 'replay', undefined);
    expect((await offline.send(request)).probabilities).toEqual({ t0: 0.6 });
    expect(offline.hits).toBe(1);
  });

  it('fails loudly when replaying an unrecorded batch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jti-'));
    await expect(new FixtureTransport(dir, 'replay', live).send(request)).rejects.toThrow(/no recorded answer/);
  });

  it('fails when there is neither a key nor a fixture', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jti-'));
    await expect(new FixtureTransport(dir, 'auto', undefined).send(request)).rejects.toThrow(/no Jev key/);
  });
});

describe('JevJudge', () => {
  const tests = ['a', 'b', 'c'].map((title) => testCase({ file: 'tests/e2e/x.spec.ts', titlePath: [title], steps: `click ${title}` }));
  const change = { path: 'src/x.ts', status: 'modified' as const, binary: false, hunks: [{ header: '@@', removed: ['old'], added: ['new'] }] };

  it('batches questions and maps answers back to tests', async () => {
    const sent: JevRequest[] = [];
    const transport: JevTransport = {
      send: async (req) => {
        sent.push(req);
        return { model: 'm', probabilities: Object.fromEntries(Object.keys(req.questions).map((key, i) => [key, i / 10])), inputTokens: 5 };
      },
    };
    const verdicts = await new JevJudge(transport, 2).judge(change, tests);
    expect(sent.map((req) => Object.keys(req.questions))).toEqual([['t0', 't1'], ['t0']]);
    expect([...verdicts.probabilities.values()]).toEqual([0, 0.1, 0]);
    expect(verdicts).toMatchObject({ calls: 2, questions: 3, inputTokens: 10 });
  });

  it('sends the diff as state and the test as structured instructions', () => {
    expect(describeChange(change)).toEqual({ file: 'src/x.ts', status: 'modified', hunks: [{ location: '@@', removed: ['old'], added: ['new'] }] });
    expect(question(tests[0]!).instructions).toMatchObject({ test: { title: 'a', steps: 'click a' } });
  });

  it('refuses silent gaps in the answers', async () => {
    const transport: JevTransport = { send: async () => ({ model: 'm', probabilities: {}, inputTokens: 0 }) };
    await expect(new JevJudge(transport, 5).judge(change, tests)).rejects.toThrow(/no answer/);
  });
});
