import { describe, expect, it } from 'vitest';
import { backfillSeedSignatures } from './backfillVerifiedBurns.js';
import {
  KNOWN_BURNER_WALLET,
  KNOWN_MHOOD_BURN_SIGNATURES,
  MHOOD_BURN_MINT,
} from './knownMhoodBurns.js';
import { MemoryVerifiedBurnStore } from './verifiedBurnStore.js';
import { SPL_TOKEN_PROGRAM_ID } from '../src/types/index.js';

const SIG_1 = KNOWN_MHOOD_BURN_SIGNATURES[0];
const SIG_2 = KNOWN_MHOOD_BURN_SIGNATURES[1];

function parsedBurn(overrides?: {
  mint?: string;
  authority?: string;
  err?: unknown;
  amount?: string;
}) {
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
                mint: overrides?.mint ?? MHOOD_BURN_MINT,
                authority: overrides?.authority ?? KNOWN_BURNER_WALLET,
                tokenAmount: { amount: overrides?.amount ?? '1000000', decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: { err: overrides?.err ?? null, innerInstructions: [] },
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function seedFetch(input: {
  txs?: Record<string, unknown>;
  methods?: string[];
  hang?: boolean;
}): typeof fetch {
  return (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string; params?: unknown[] };
    input.methods?.push(body.method ?? '');
    if (input.hang) {
      return await new Promise((_, reject) => {
        const abort = () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort, { once: true });
      });
    }
    if (body.method === 'getTransaction') {
      const signature = String(body.params?.[0] ?? '');
      if (signature in (input.txs ?? {})) {
        return jsonResponse({ result: input.txs?.[signature] });
      }
      return jsonResponse({ result: parsedBurn() });
    }
    return jsonResponse({ error: { message: `unexpected RPC ${body.method}` } }, 400);
  }) as typeof fetch;
}

describe('seed verified burn backfill', () => {
  it('verifies and inserts both known signatures without a history scan', async () => {
    const store = new MemoryVerifiedBurnStore();
    const methods: string[] = [];
    const started = Date.now();
    const result = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store,
      signatures: [SIG_1, SIG_2],
      fetchImpl: seedFetch({ methods }),
    });
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(methods).not.toContain('getSignaturesForAddress');
    expect(methods.filter((method) => method === 'getTransaction')).toHaveLength(2);
    expect(result).toMatchObject({
      mode: 'seed',
      verified: 2,
      inserted: 2,
      alreadyIndexed: 0,
      failed: 0,
    });
    expect(result.records.map((record) => record.signature).sort()).toEqual([SIG_1, SIG_2].sort());
    expect(await store.list()).toHaveLength(2);
  });

  it('is idempotent and reports alreadyIndexed on the second run', async () => {
    const store = new MemoryVerifiedBurnStore();
    const fetchImpl = seedFetch({});
    const first = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store,
      signatures: [SIG_1, SIG_2],
      fetchImpl,
    });
    const methods: string[] = [];
    const second = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store,
      signatures: [SIG_1, SIG_2],
      fetchImpl: seedFetch({ methods }),
    });
    expect(first).toMatchObject({ verified: 2, inserted: 2, alreadyIndexed: 0, failed: 0 });
    expect(second).toMatchObject({ verified: 2, inserted: 0, alreadyIndexed: 2, failed: 0 });
    expect(methods).not.toContain('getTransaction');
    expect(await store.list()).toHaveLength(2);
  });

  it('rejects a BurnChecked for the wrong mint', async () => {
    const result = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store: new MemoryVerifiedBurnStore(),
      signatures: [SIG_1],
      fetchImpl: seedFetch({
        txs: { [SIG_1]: parsedBurn({ mint: 'So11111111111111111111111111111111111111112' }) },
      }),
    });
    expect(result).toMatchObject({ verified: 0, inserted: 0, alreadyIndexed: 0, failed: 1 });
    expect(result.failures[0]?.reason).toMatch(/mint/);
  });

  it('rejects a BurnChecked from the wrong authority', async () => {
    const result = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store: new MemoryVerifiedBurnStore(),
      signatures: [SIG_1],
      fetchImpl: seedFetch({
        txs: { [SIG_1]: parsedBurn({ authority: 'Other1111111111111111111111111111111111111' }) },
      }),
    });
    expect(result).toMatchObject({ verified: 0, inserted: 0, failed: 1 });
    expect(result.failures[0]?.reason).toMatch(/authority/);
  });

  it('rejects an invalid or failed transaction', async () => {
    const missing = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store: new MemoryVerifiedBurnStore(),
      signatures: [SIG_1],
      fetchImpl: seedFetch({ txs: { [SIG_1]: null } }),
    });
    expect(missing.failed).toBe(1);
    expect(missing.failures[0]?.reason).toMatch(/could not confirm/);

    const failedTx = await backfillSeedSignatures({
      rpcUrl: 'https://example.helius.invalid',
      store: new MemoryVerifiedBurnStore(),
      signatures: [SIG_2],
      fetchImpl: seedFetch({ txs: { [SIG_2]: parsedBurn({ err: { InstructionError: [0, 'Custom'] } }) } }),
    });
    expect(failedTx.failed).toBe(1);
    expect(failedTx.failures[0]?.reason).toMatch(/failed on-chain/);
  });

  it('aborts the seed with a stage error when getTransaction times out', async () => {
    const store = new MemoryVerifiedBurnStore();
    const methods: string[] = [];
    const started = Date.now();
    await expect(
      backfillSeedSignatures({
        rpcUrl: 'https://example.helius.invalid',
        store,
        signatures: [SIG_1, SIG_2],
        timeoutMs: 25,
        fetchImpl: (async (_url, init) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string; params?: unknown[] };
          methods.push(body.method ?? '');
          return await new Promise((_, reject) => {
            const abort = () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            };
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener('abort', abort, { once: true });
          });
        }) as typeof fetch,
      }),
    ).rejects.toMatchObject({
      name: 'BackfillStageError',
      stage: 'helius-rpc',
      message: 'RPC getTransaction timed out',
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(methods).not.toContain('getSignaturesForAddress');
    expect(await store.list()).toEqual([]);
  });
});
