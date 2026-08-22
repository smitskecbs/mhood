import { describe, expect, it } from 'vitest';
import { backfillVerifiedBurns } from './backfillVerifiedBurns.js';
import { MemoryVerifiedBurnStore } from './verifiedBurnStore.js';
import type { BurnRecord } from '../src/types/index.js';

const wallet = 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY';
const mint = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';

function record(signature: string): BurnRecord {
  return {
    signature,
    wallet,
    mint,
    amountRaw: '1000000',
    amountUi: '1',
    slot: 1,
    timestamp: 1,
  };
}

describe('verified burn backfill', () => {
  it('imports multiple verified burns from the same wallet and skips duplicates', async () => {
    const store = new MemoryVerifiedBurnStore();
    const result = await backfillVerifiedBurns({
      rpcUrl: 'https://example.helius.invalid',
      store,
      seedSignatures: ['sig-1', 'sig-2', 'sig-noise'],
      listSignatures: async () => ['sig-1', 'sig-2'],
      verify: async (signature) => {
        if (signature === 'sig-noise') throw new Error('BurnChecked mint does not match MHOOD.');
        return record(signature);
      },
    });
    expect(result.imported).toHaveLength(2);
    expect(result.duplicates).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    const again = await backfillVerifiedBurns({
      rpcUrl: 'https://example.helius.invalid',
      store,
      seedSignatures: ['sig-1', 'sig-2'],
      listSignatures: async () => ['sig-1'],
      verify: async (signature) => record(signature),
    });
    expect(again.imported).toHaveLength(0);
    expect(again.duplicates.length).toBeGreaterThan(0);
    expect(await store.list()).toHaveLength(2);
  });
});
