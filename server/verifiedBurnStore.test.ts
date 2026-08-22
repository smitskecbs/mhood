import { describe, expect, it } from 'vitest';
import { handleVerifiedBurnsRequest } from './verifiedBurnsApi.js';
import {
  MemoryVerifiedBurnStore,
  UpstashVerifiedBurnStore,
  createUpstashVerifiedBurnStore,
  readUpstashCredentials,
  resetUpstashCredentialLog,
} from './verifiedBurnStore.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import type { BurnRecord } from '../src/types/index.js';

const wallet = 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY';
const mint = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';

function record(signature: string, amountRaw = '1000000'): BurnRecord {
  return {
    signature,
    wallet,
    mint,
    amountRaw,
    amountUi: '1',
    slot: signature === 'sig-a' ? 1 : 2,
    timestamp: 10,
  };
}

describe('verified burn persistence', () => {
  it('stores a valid record and does not duplicate the same signature', async () => {
    const store = new MemoryVerifiedBurnStore();
    const first = await store.add(record('sig-a'));
    const second = await store.add(record('sig-a'));
    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(await store.list()).toHaveLength(1);
  });

  it('keeps records across separate GET/POST requests', async () => {
    const store = new MemoryVerifiedBurnStore();
    const verify = async () => ({ record: record('sig-a'), added: true });
    await handleVerifiedBurnsRequest({
      httpMethod: 'POST',
      body: { signature: 'sig-a' },
      rpcUrl: 'https://example.helius.invalid',
      store,
      verify,
    });
    const firstGet = await handleVerifiedBurnsRequest({
      httpMethod: 'GET',
      body: null,
      rpcUrl: 'https://example.helius.invalid',
      store,
    });
    await handleVerifiedBurnsRequest({
      httpMethod: 'POST',
      body: { signature: 'sig-b' },
      rpcUrl: 'https://example.helius.invalid',
      store,
      verify: async () => ({ record: record('sig-b'), added: true }),
    });
    const secondGet = await handleVerifiedBurnsRequest({
      httpMethod: 'GET',
      body: null,
      rpcUrl: 'https://example.helius.invalid',
      store,
    });
    expect(firstGet.status).toBe(200);
    expect((firstGet.body as { records: BurnRecord[] }).records).toHaveLength(1);
    expect((secondGet.body as { persistence: string }).persistence).toBe('persistent');
    expect((secondGet.body as { records: BurnRecord[] }).records).toHaveLength(2);
  });

  it('uses HSETNX so Upstash cannot double-count a signature', async () => {
    const data = new Map<string, string>();
    const store = new UpstashVerifiedBurnStore(async (command) => {
      const [op, , field, value] = command;
      if (op === 'HSETNX') {
        if (data.has(field!)) return 0;
        data.set(field!, value!);
        return 1;
      }
      if (op === 'HGET') return data.get(field!) ?? null;
      if (op === 'HVALS') return [...data.values()];
      return null;
    });
    expect((await store.add(record('sig-a'))).added).toBe(true);
    expect((await store.add(record('sig-a'))).added).toBe(false);
    expect(await store.list()).toHaveLength(1);
  });
});

describe('Upstash REST credential env names', () => {
  it('selects UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN when both are set', () => {
    const credentials = readUpstashCredentials({
      UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-write-token',
      KV_REST_API_URL: 'https://kv.example/rest',
      KV_REST_API_TOKEN: 'kv-write-token',
      KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
    });
    expect(credentials).toMatchObject({
      source: 'upstash',
      urlEnv: 'UPSTASH_REDIS_REST_URL',
      tokenEnv: 'UPSTASH_REDIS_REST_TOKEN',
      url: 'https://upstash.example/rest',
      token: 'upstash-write-token',
    });
  });

  it('falls back to KV_REST_API_URL / KV_REST_API_TOKEN when Upstash names are absent', () => {
    const credentials = readUpstashCredentials({
      KV_REST_API_URL: 'https://kv.example/rest',
      KV_REST_API_TOKEN: 'kv-write-token',
      KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
      KV_URL: 'rediss://example.upstash.io:6379',
      REDIS_URL: 'rediss://example.upstash.io:6379',
    });
    expect(credentials).toMatchObject({
      source: 'vercel-kv',
      urlEnv: 'KV_REST_API_URL',
      tokenEnv: 'KV_REST_API_TOKEN',
      url: 'https://kv.example/rest',
      token: 'kv-write-token',
    });
    expect(credentials?.token).not.toBe('kv-readonly-token');
  });

  it('does not mix a partial Upstash pair with the read-only token; complete KV pair still wins', () => {
    expect(
      readUpstashCredentials({
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: 'kv-write-token',
        KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
      }),
    ).toMatchObject({
      urlEnv: 'KV_REST_API_URL',
      tokenEnv: 'KV_REST_API_TOKEN',
      token: 'kv-write-token',
    });
  });

  it('never uses the read-only KV token or redis:// URLs for writes', () => {
    expect(
      readUpstashCredentials({
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
        KV_URL: 'rediss://example.upstash.io:6379',
        REDIS_URL: 'rediss://example.upstash.io:6379',
      }),
    ).toBeNull();
    expect(
      readUpstashCredentials({
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
      }),
    ).toBeNull();
  });

  it('activates the Upstash store from either complete env-name set', () => {
    resetUpstashCredentialLog();
    expect(
      createVerifiedBurnStore({
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        UPSTASH_REDIS_REST_TOKEN: 'upstash-write-token',
      }).kind,
    ).toBe('upstash');
    expect(
      createVerifiedBurnStore({
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: 'kv-write-token',
        KV_REST_API_READ_ONLY_TOKEN: 'kv-readonly-token',
      }).kind,
    ).toBe('upstash');
    expect(createUpstashVerifiedBurnStore({})).toBeNull();
  });
});
