import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVerifiedBurnLedger, submitVerifiedBurnSignature } from './verifiedBurnClient';

describe('verified burn client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats GET failures as inactive persistence instead of a fake local ledger', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );
    await expect(fetchVerifiedBurnLedger()).resolves.toEqual({
      records: [],
      persistence: 'inactive',
    });
  });

  it('does not throw when POST persistence is inactive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          verified: true,
          persistence: 'inactive',
          record: {
            signature: 'sig',
            wallet: 'WALLET',
            mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
            amountRaw: '1000000',
            amountUi: '1',
            slot: 1,
            timestamp: null,
          },
        }),
      ),
    );
    await expect(submitVerifiedBurnSignature('sig')).resolves.toMatchObject({
      verified: true,
      persistence: 'inactive',
    });
  });
});
