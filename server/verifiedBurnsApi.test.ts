import { describe, expect, it } from 'vitest';
import { handleVerifiedBurnsRequest, verifiedBurnsGetBody } from './verifiedBurnsApi';

describe('verified burns API persistence', () => {
  it('returns empty records when production persistence is inactive', async () => {
    const result = await handleVerifiedBurnsRequest({
      httpMethod: 'GET',
      body: null,
      persistence: 'inactive',
      records: [
        {
          signature: 'should-not-leak',
          wallet: 'WALLET',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1',
          amountUi: '0.000001',
          slot: 1,
          timestamp: null,
        },
      ],
      rpcUrl: 'https://example.invalid',
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ records: [], persistence: 'inactive' });
    expect(verifiedBurnsGetBody([], 'inactive').persistence).toBe('inactive');
  });

  it('does not fake-persist on Vercel when no store is configured', async () => {
    let persisted = false;
    const result = await handleVerifiedBurnsRequest({
      httpMethod: 'GET',
      body: null,
      persistence: 'inactive',
      records: [],
      rpcUrl: '',
      persist: () => {
        persisted = true;
        return [];
      },
    });
    expect(result.status).toBe(200);
    expect(persisted).toBe(false);
  });
});
