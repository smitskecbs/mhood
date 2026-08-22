import { describe, expect, it, vi } from 'vitest';
import { fetchAllMintTokenAccounts } from './heliusTokenAccounts';

describe('Helius getTokenAccounts pagination', () => {
  it('walks every page and deduplicates accounts', async () => {
    const request = vi.fn(async (_method: string, params: Record<string, unknown>) => {
      if (params.page === 1) {
        return {
          token_accounts: [
            { address: 'acc-1', owner: 'owner-a', amount: '10' },
            { address: 'acc-2', owner: 'owner-b', amount: 20 },
          ],
          cursor: 'cursor-1',
        };
      }
      return {
        token_accounts: [{ address: 'acc-3', owner: 'owner-a', amount: '30' }],
      };
    });

    const accounts = await fetchAllMintTokenAccounts({
      mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
      request,
      pageSize: 2,
      maxPages: 5,
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe('getTokenAccounts');
    expect(accounts).toEqual([
      { address: 'acc-1', owner: 'owner-a', amountRaw: 10n },
      { address: 'acc-2', owner: 'owner-b', amountRaw: 20n },
      { address: 'acc-3', owner: 'owner-a', amountRaw: 30n },
    ]);
  });

  it('stops when a page is empty and never loops forever', async () => {
    const request = vi.fn(async () => ({ token_accounts: [] }));
    const accounts = await fetchAllMintTokenAccounts({
      mint: 'mint',
      request,
      pageSize: 1000,
      maxPages: 3,
    });
    expect(accounts).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
