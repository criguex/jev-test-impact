export const MODEL = 'jev-latest';

export interface NoulQuestion {
  type: 'noul';
  instructions: unknown;
  criteria?: { true: string; false: string };
}

export interface JevRequest {
  model: string;
  state: unknown;
  questions: Record<string, NoulQuestion>;
}

export interface JevResponse {
  model: string;
  probabilities: Record<string, number>;
  inputTokens: number;
}

export class JevError extends Error {}

export interface JevTransport {
  send(request: JevRequest): Promise<JevResponse>;
}

interface Endpoint {
  url: string;
  key: string;
  via: string;
}

export function endpointFromEnv(env: NodeJS.ProcessEnv = process.env): Endpoint | undefined {
  if (env.TYPESAFE_API_KEY) {
    return { url: 'https://api.typesafe.ai/v1/systemone', key: env.TYPESAFE_API_KEY, via: 'typesafe' };
  }
  if (env.AI_GATEWAY_API_KEY) {
    return { url: 'https://ai-gateway.vercel.sh/typesafe/v1/systemone', key: env.AI_GATEWAY_API_KEY, via: 'vercel-gateway' };
  }
  return undefined;
}

export function normalizeAnswers(raw: unknown): Record<string, number> {
  const answers = (raw as { answers?: Record<string, Record<string, unknown>> })?.answers;
  if (!answers || typeof answers !== 'object') {
    throw new JevError(`response has no answers: ${JSON.stringify(raw).slice(0, 400)}`);
  }
  return Object.fromEntries(
    Object.entries(answers).map(([key, answer]) => {
      const value = answer.noul ?? answer.probability ?? answer.boolean;
      const probability = typeof value === 'boolean' ? Number(value) : value;
      if (typeof probability !== 'number' || Number.isNaN(probability) || probability < 0 || probability > 1) {
        throw new JevError(`answer ${key} is not a probability: ${JSON.stringify(answer)}`);
      }
      return [key, probability];
    }),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpTransport implements JevTransport {
  constructor(
    private readonly endpoint: Endpoint,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly retries = Number(process.env.JTI_JEV_RETRIES ?? 4),
    private readonly baseDelayMs = 1000,
  ) {}

  async send(request: JevRequest): Promise<JevResponse> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetchImpl(this.endpoint.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.endpoint.key}` },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await wait(retryAfter > 0 ? retryAfter * 1000 : this.baseDelayMs * 2 ** attempt);
        continue;
      }
      const body = await response.text();
      if (!response.ok) {
        throw new JevError(`${response.status} via ${this.endpoint.via}: ${body.slice(0, 600) || 'empty body'}`);
      }
      let payload: { model?: string; usage?: { input_tokens?: number } };
      try {
        payload = JSON.parse(body);
      } catch {
        throw new JevError(`non-JSON response via ${this.endpoint.via}: ${body.slice(0, 600)}`);
      }
      return {
        model: `${payload.model ?? 'unknown'} via ${this.endpoint.via}`,
        probabilities: normalizeAnswers(payload),
        inputTokens: payload.usage?.input_tokens ?? 0,
      };
    }
  }
}
