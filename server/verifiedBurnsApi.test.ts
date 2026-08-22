import { describe, expect, it } from 'vitest';
import { GET } from '../api/verified-burns.js';
import { handleVerifiedBurnsRequest, verifiedBurnsGetBody } from './verifiedBurnsApi.js';

const validRecord = {
  signature: 'sig-valid',
  wallet: 'WALLET',
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  amountRaw: '1000000',
  amountUi: '1',
  slot: 9,
  timestamp: 99,
};

describe('verified burns API persistence', () => {
  it('returns empty records with HTTP 200 when production persistence is inactive', async () => {
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

  it('returns HTTP 200 and verified true for a valid burn without storing it', async () => {
    let persisted = false;
    const result = await handleVerifiedBurnsRequest({
      httpMethod: 'POST',
      body: { signature: 'sig-valid' },
      persistence: 'inactive',
      records: [],
      rpcUrl: 'https://example.helius.invalid',
      persist: () => {
        persisted = true;
        return [validRecord];
      },
      verify: async () => ({ record: validRecord, added: true }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      verified: true,
      record: validRecord,
      persistence: 'inactive',
      added: false,
    });
    expect(persisted).toBe(false);
  });

  it('GET production handler returns 200 with inactive persistence', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ records: [], persistence: 'inactive' });
  });
});
