import { describe, expect, it } from 'vitest';
import { HolderRankingService, MockHolderRankingProvider, createHolderRankingService, findWalletRank, resetHolderRankingCache } from './holderRankingService';
import { parseRealBurnFlag } from '../config/env';
import type { MintDetails } from '../types';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1_000_000_000_000_000n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

describe('holderRankingService', () => {
  it('keeps mock fixtures out of the live provider path', async () => {
    resetHolderRankingCache();
    const service = new HolderRankingService(new MockHolderRankingProvider());
    const snapshot = await service.getRanking(mint);
    expect(snapshot.live).toBe(false);
    expect(snapshot.source).toBe('mock');
    expect(snapshot.entries[0]?.rank).toBe(1);
    expect(findWalletRank(snapshot, 'RealWallet111111111111111111111111111')).toBeNull();
  });

  it('reuses cache until retry asks to bypass it', async () => {
    resetHolderRankingCache();
    let calls = 0;
    const service = new HolderRankingService({
      kind: 'rpc',
      live: true,
      disclaimer: 'test',
      fetchHolders: async () => {
        calls += 1;
        return [
          {
            rank: 1,
            wallet: 'WALLET_A',
            balanceRaw: '1000',
            balanceUi: '0.001',
            supplyPercent: '<0.01%',
          },
        ];
      },
    });
    await service.getRanking(mint);
    await service.getRanking(mint);
    expect(calls).toBe(1);
    await service.getRanking(mint, { bypassCache: true });
    expect(calls).toBe(2);
  });

  it('does not enable real burns unless the env flag is the string true', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
  });

  it('keeps the live app on the Helius/RPC ranking provider', () => {
    expect(createHolderRankingService()).toBeInstanceOf(HolderRankingService);
  });
});
