import { describe, expect, it } from 'vitest';
import { PROJECT_WALLETS } from '../config/projectWallets';
import {
  findCommunityWalletRank,
  presentHolderRanking,
  shouldShowYourPositionCard,
  visibleCommunityLeaderboard,
} from './holderPresentation';
import type { HolderRankingEntry, HolderRankingSnapshot } from '../types';

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

function communityEntry(rank: number, wallet: string, balanceRaw: string): HolderRankingEntry {
  return {
    rank,
    wallet,
    balanceRaw,
    balanceUi: balanceRaw,
    supplyPercent: '0.01%',
  };
}

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

  it('keeps the full community list for ranks and tokenomics when the leaderboard shows Top 20', () => {
    const community = Array.from({ length: 48 }, (_, index) =>
      communityEntry(
        index + 2,
        `Community${(index + 1).toString().padStart(2, '0')}111111111111111111111111`,
        String((48 - index) * 1_000_000),
      ),
    );
    const presented = presentHolderRanking(
      {
        ...snapshot,
        entries: [snapshot.entries[0]!, ...community, snapshot.entries[5]!],
      },
      6,
      supplyRaw,
    );
    expect(presented.onChainEntries).toHaveLength(50);
    expect(presented.communityEntries).toHaveLength(48);
    expect(presented.communityHolderCount).toBe(48);
    expect(presented.communityHeldRaw).toBe(
      community.reduce((total, entry) => total + BigInt(entry.balanceRaw), 0n),
    );
    const visible = visibleCommunityLeaderboard(presented.communityEntries);
    expect(visible).toHaveLength(20);
    expect(visible.map((entry) => entry.rank)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(visible.some((entry) => entry.rank === 21)).toBe(false);
    expect(findCommunityWalletRank(presented, community[26]!.wallet)).toBe(27);
    expect(shouldShowYourPositionCard(visible, presented.communityEntries[26])).toBe(true);
    expect(shouldShowYourPositionCard(visible, presented.communityEntries[7])).toBe(false);
  });
});
