import { describe, expect, it } from 'vitest';
import { handleVerifiedBurnsRequest } from './verifiedBurnsApi.js';
import { MemoryVerifiedBurnStore, UpstashVerifiedBurnStore } from './verifiedBurnStore.js';
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
