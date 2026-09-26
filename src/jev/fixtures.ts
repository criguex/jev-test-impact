import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JevError, type JevRequest, type JevResponse, type JevTransport } from './client.js';

export type FixtureMode = 'auto' | 'replay' | 'record' | 'live';

export interface Recorded {
  request: JevRequest;
  response: JevResponse;
}

export function fixtureKey(request: JevRequest): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex').slice(0, 24);
}

export class FixtureTransport implements JevTransport {
  hits = 0;

  constructor(
    private readonly dir: string,
    private readonly mode: FixtureMode,
    private readonly live: JevTransport | undefined,
  ) {}

  private path(request: JevRequest): string {
    return join(this.dir, `${fixtureKey(request)}.json`);
  }

  async send(request: JevRequest): Promise<JevResponse> {
    const path = this.path(request);
    const useFixture = this.mode === 'replay' || (this.mode === 'auto' && existsSync(path));
    if (useFixture) {
      if (!existsSync(path)) {
        throw new JevError(`no recorded answer for this question batch (${fixtureKey(request)}); record it with JTI_JEV_MODE=record`);
      }
      this.hits++;
      return (JSON.parse(readFileSync(path, 'utf8')) as Recorded).response;
    }
    if (!this.live) {
      throw new JevError('no Jev key (AI_GATEWAY_API_KEY or TYPESAFE_API_KEY) and no recorded answer');
    }
    const response = await this.live.send(request);
    if (this.mode === 'record' || this.mode === 'auto') {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(path, `${JSON.stringify({ request, response } satisfies Recorded, null, 2)}\n`);
    }
    return response;
  }
}
