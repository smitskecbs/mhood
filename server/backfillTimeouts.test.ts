// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAdminBackfillRequest, HANDLER_DEADLINE_MS } from './adminBackfill.js';
import {
  KNOWN_BURNER_WALLET,
  MHOOD_BURN_MINT,
} from './knownMhoodBurns.js';
import {
  executeUpstashCommand,
  MemoryVerifiedBurnStore,
  UPSTASH_TIMEOUT_MS,
  UpstashVerifiedBurnStore,
  BURN_STORE_HEALTH_FIELD,
  VERIFIED_BURNS_REDIS_KEY,
  verifyBurnStoreHealth,
} from './verifiedBurnStore.js';
import { SPL_TOKEN_PROGRAM_ID } from '../src/types/index.js';

const KV_URL = 'https://kv.example/rest';
const HELIUS_URL = 'https://example.helius.invalid';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hangingFetch(): typeof fetch {
  return (() => new Promise(() => {})) as typeof fetch;
}

function parsedBurn() {
  return {
    slot: 1,
    blockTime: 10,
    transaction: {
      message: {
        instructions: [
          {
            program: 'spl-token',
            programId: SPL_TOKEN_PROGRAM_ID,
            parsed: {
              type: 'burnChecked',
              info: {
                mint: MHOOD_BURN_MINT,
                authority: KNOWN_BURNER_WALLET,
                tokenAmount: { amount: '1000000', decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: { err: null, innerInstructions: [] },
  };
}

function kvAndHeliusFetch(options?: {
  hangOn?: 'HGET' | 'HSETNX' | 'getTransaction';
  hangAfterHealth?: boolean;
}): typeof fetch {
  const data = new Map<string, string>();
  let hgetCount = 0;
  return (async (url, init) => {
    const href = String(url);
    if (href.includes('kv.example')) {
      const command = JSON.parse(String(init?.body ?? '[]')) as string[];
      const [op, , field, value] = command;
      if (op === 'HGET') {
        hgetCount += 1;
        if (options?.hangOn === 'HGET' && (!options.hangAfterHealth || hgetCount > 1)) {
          return await new Promise(() => {});
        }
        return jsonResponse({ result: data.get(field!) ?? null });
      }
      if (op === 'HSETNX') {
        if (options?.hangOn === 'HSETNX') return await new Promise(() => {});
        if (data.has(field!)) return jsonResponse({ result: 0 });
        data.set(field!, value!);
        return jsonResponse({ result: 1 });
      }
      return jsonResponse({ result: null });
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string; params?: unknown[] };
    if (body.method === 'getSignaturesForAddress') {
      throw new Error('seed backfill must not scan history');
    }
    if (body.method === 'getTransaction') {
      if (options?.hangOn === 'getTransaction') return await new Promise(() => {});
      return jsonResponse({ result: parsedBurn() });
    }
    return jsonResponse({ error: { message: `unexpected RPC ${body.method}` } }, 400);
  }) as typeof fetch;
}

const authorizedEnv = {
  BURN_BACKFILL_SECRET: 'forest-secret',
  HELIUS_RPC_URL: HELIUS_URL,
  KV_REST_API_URL: KV_URL,
  KV_REST_API_TOKEN: 'kv-write-token',
};

describe('backfill timeouts and stage errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads from Upstash REST successfully', async () => {
    const result = await executeUpstashCommand(
      { url: KV_URL, token: 'kv-write-token' },
      ['HGET', 'moginhood:verified-burns', 'missing'],
      (async (_url, init) => {
        expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toBe(
          'Bearer kv-write-token',
        );
        expect(JSON.parse(String(init?.body))).toEqual(['HGET', 'moginhood:verified-burns', 'missing']);
        return jsonResponse({ result: null });
      }) as typeof fetch,
    );
    expect(result).toBeNull();
  });

  it('times out a hanging Upstash read', async () => {
    const started = Date.now();
    await expect(
      executeUpstashCommand({ url: KV_URL, token: 'token' }, ['HGET', 'k', 'f'], hangingFetch(), 30),
    ).rejects.toThrow('Upstash read timeout');
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('writes to Upstash REST successfully', async () => {
    const result = await executeUpstashCommand(
      { url: `${KV_URL}/`, token: 'kv-write-token' },
      ['HSETNX', 'moginhood:verified-burns', 'sig', '{}'],
      (async (url, init) => {
        expect(String(url)).toBe(KV_URL);
        expect(JSON.parse(String(init?.body))[0]).toBe('HSETNX');
        return jsonResponse({ result: 1 });
      }) as typeof fetch,
    );
    expect(result).toBe(1);
  });

  it('times out a hanging Upstash write', async () => {
    const started = Date.now();
    await expect(
      executeUpstashCommand({ url: KV_URL, token: 'token' }, ['HSETNX', 'k', 'f', 'v'], hangingFetch(), 30),
    ).rejects.toThrow('Upstash write timeout');
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('returns JSON store-health error before a Vercel timeout', async () => {
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      fetchImpl: hangingFetch(),
      upstashTimeoutMs: 40,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      ok: false,
      stage: 'store-health',
      error: 'Upstash read timeout',
    });
  });

  it('returns JSON store-read error when a later Upstash HGET hangs', async () => {
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      fetchImpl: kvAndHeliusFetch({ hangOn: 'HGET', hangAfterHealth: true }),
      upstashTimeoutMs: 40,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      ok: false,
      stage: 'store-read',
      error: 'Upstash read timeout',
    });
  });

  it('returns JSON store-write error when Upstash HSETNX hangs', async () => {
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      fetchImpl: kvAndHeliusFetch({ hangOn: 'HSETNX' }),
      upstashTimeoutMs: 40,
      timeoutMs: 200,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      ok: false,
      stage: 'store-write',
      error: 'Upstash write timeout',
    });
  });

  it('returns JSON helius-rpc error when getTransaction hangs', async () => {
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      fetchImpl: kvAndHeliusFetch({ hangOn: 'getTransaction' }),
      timeoutMs: 40,
      upstashTimeoutMs: 200,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      ok: false,
      stage: 'helius-rpc',
      error: 'RPC getTransaction timed out',
    });
  });

  it('logs seed 1 and seed 2 stages and finishes under 10 seconds with mocks', async () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      store: new MemoryVerifiedBurnStore(),
      fetchImpl: kvAndHeliusFetch(),
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      verified: 2,
      inserted: 2,
      alreadyIndexed: 0,
      failed: 0,
    });
    const lines = info.mock.calls.map((args) => String(args[0]));
    const backfill = lines.filter((line) => line.startsWith('[MoginHood backfill]'));
    expect(backfill).toEqual(expect.arrayContaining([
      '[MoginHood backfill] parsing request',
      '[MoginHood backfill] request parsed',
      '[MoginHood backfill] auth ok',
      '[MoginHood backfill] creating store',
      '[MoginHood backfill] store created',
      '[MoginHood backfill] store health start',
      '[MoginHood backfill] store health ok',
      '[MoginHood backfill] seed count: 2',
      '[MoginHood backfill] seed 1 existing read start',
      '[MoginHood backfill] seed 1 existing read complete',
      '[MoginHood backfill] seed 1 helius start',
      '[MoginHood backfill] seed 1 helius complete',
      '[MoginHood backfill] seed 1 verify complete',
      '[MoginHood backfill] seed 1 write start',
      '[MoginHood backfill] seed 1 write complete',
      '[MoginHood backfill] seed 1 complete',
      '[MoginHood backfill] seed 2 existing read start',
      '[MoginHood backfill] seed 2 write complete',
      '[MoginHood backfill] seed 2 complete',
    ]));
    expect(backfill.some((line) => line.startsWith('[MoginHood backfill] complete'))).toBe(true);
    expect(backfill.join('\n')).not.toMatch(/forest-secret|kv-write-token|HELIUS_RPC_URL/);
    expect(info.mock.calls.flat().join('\n')).not.toContain(HELIUS_URL);
    expect(UPSTASH_TIMEOUT_MS).toBe(5_000);
    expect(HANDLER_DEADLINE_MS).toBe(20_000);
  });

  it('does not scan history during a successful mocked seed', async () => {
    const methods: string[] = [];
    const fetchImpl = ((url: string | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      if (body.includes('getSignaturesForAddress')) {
        throw new Error('seed backfill must not scan history');
      }
      if (body.includes('getTransaction')) methods.push('getTransaction');
      return kvAndHeliusFetch()(url, init);
    }) as typeof fetch;
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      store: new MemoryVerifiedBurnStore(),
      fetchImpl,
    });
    expect(result.status).toBe(200);
    expect(methods).toEqual(['getTransaction', 'getTransaction']);
  });

  it('proves store health is a read that writes nothing', async () => {
    const commands: string[][] = [];
    await verifyBurnStoreHealth(new MemoryVerifiedBurnStore());
    const store = new UpstashVerifiedBurnStore(async (command) => {
      commands.push(command);
      return null;
    });
    await verifyBurnStoreHealth(store);
    expect(commands).toEqual([['HGET', VERIFIED_BURNS_REDIS_KEY, BURN_STORE_HEALTH_FIELD]]);
  });

  it('returns JSON handler-timeout before Vercel can kill the isolate', async () => {
    class HangStore extends MemoryVerifiedBurnStore {
      async health(): Promise<void> {
        await new Promise(() => {});
      }
    }
    const started = Date.now();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: authorizedEnv,
      store: new HangStore(),
      deadlineMs: 80,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      ok: false,
      stage: 'handler-timeout',
      error: 'Backfill exceeded 1 second deadline',
    });
  });
});
