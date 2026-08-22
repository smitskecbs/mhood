import { describe, expect, it } from 'vitest';
import { PROJECT_WALLETS } from '../config/projectWallets';
import { findCommunityWalletRank, presentHolderRanking } from './holderPresentation';
import type { HolderRankingSnapshot } from '../types';

const supplyRaw = 1_000_000_000_000_000n;

const snapshot: HolderRankingSnapshot = {
  live: true,
  source: 'rpc',
  disclaimer: 'test',
  fetchedAt: 0,
  entries: [
    {
      rank: 1,
      wallet: PROJECT_WALLETS.treasury.address,
      balanceRaw: '500000000000000',
      balanceUi: '500,000,000',
      supplyPercent: '50.00%',
    },
    {
      rank: 2,
      wallet: 'CommunityA11111111111111111111111111111111',
      balanceRaw: '200000000000000',
      balanceUi: '200,000,000',
      supplyPercent: '20.00%',
    },
    {
      rank: 3,
      wallet: PROJECT_WALLETS.dev.address,
      balanceRaw: '50000000000000',
      balanceUi: '50,000,000',
      supplyPercent: '5.00%',
    },
    {
      rank: 4,
      wallet: PROJECT_WALLETS.presale.address,
      balanceRaw: '40000000000000',
      balanceUi: '40,000,000',
      supplyPercent: '4.00%',
    },
    {
      rank: 5,
      wallet: 'CommunityB11111111111111111111111111111111',
      balanceRaw: '10000000000000',
      balanceUi: '10,000,000',
      supplyPercent: '1.00%',
    },
    {
      rank: 6,
      wallet: PROJECT_WALLETS.tokenLock.address,
      balanceRaw: '150000000000000',
      balanceUi: '150,000,000',
      supplyPercent: '15.00%',
    },
  ],
};

describe('holder presentation', () => {
  it('filters project wallets from community rank without dropping their balances', () => {
    const presented = presentHolderRanking(snapshot, 6, supplyRaw);
    expect(presented.onChainEntries).toHaveLength(6);
    expect(presented.communityEntries.map((entry) => entry.wallet)).toEqual([
      'CommunityA11111111111111111111111111111111',
      'CommunityB11111111111111111111111111111111',
    ]);
    expect(presented.communityEntries[0]?.rank).toBe(1);
    expect(presented.communityEntries[1]?.rank).toBe(2);
    expect(findCommunityWalletRank(presented, 'CommunityB11111111111111111111111111111111')).toBe(2);
    expect(presented.projectAllocations.map((entry) => entry.id)).toEqual([
      'treasury',
      'tokenLock',
      'dev',
      'presale',
    ]);
    expect(presented.projectHeldRaw).toBe(740_000_000_000_000n);
    expect(presented.communityHeldRaw).toBe(210_000_000_000_000n);
    expect(presented.communityHolderCount).toBe(2);
    expect(presented.projectAllocations.find((entry) => entry.id === 'treasury')?.balanceRaw).toBe(
      '500000000000000',
    );
  });
});
