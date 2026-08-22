import { describe, expect, it } from 'vitest';
import { aggregateHoldersByOwner, findWalletRank, findWalletRankingEntry } from './holderAggregation';
import { formatSupplyPercent } from './supplyPercent';

const supplyRaw = 1_000_000_000_000_000n; // 1,000,000,000 MHOOD, 6 decimals

describe('holder aggregation', () => {
  it('combines multiple token accounts for the same owner and drops zero balances', () => {
    const snapshot = aggregateHoldersByOwner(
      [
        { address: 'acc-a', owner: 'WALLET_A', amountRaw: 700_000_000_000n },
        { address: 'acc-b', owner: 'WALLET_A', amountRaw: 300_000_000_000n },
        { address: 'acc-c', owner: 'WALLET_B', amountRaw: 250_000_000_000n },
        { address: 'acc-d', owner: 'WALLET_C', amountRaw: 0n },
        { address: 'acc-a', owner: 'WALLET_A', amountRaw: 700_000_000_000n },
      ],
      6,
      supplyRaw,
    );

    expect(snapshot.live).toBe(true);
    expect(snapshot.source).toBe('rpc');
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({
      rank: 1,
      wallet: 'WALLET_A',
      balanceRaw: '1000000000000',
      balanceUi: '1,000,000',
    });
    expect(snapshot.entries[1]?.wallet).toBe('WALLET_B');
    expect(findWalletRank(snapshot, 'WALLET_A')).toBe(1);
    expect(findWalletRank(snapshot, 'UNKNOWN')).toBeNull();
  });

  it('sorts by raw balance descending using bigint precision', () => {
    const snapshot = aggregateHoldersByOwner(
      [
        { address: '1', owner: 'SMALL', amountRaw: 1n },
        { address: '2', owner: 'HUGE', amountRaw: 9_007_199_254_740_991n },
        { address: '3', owner: 'MID', amountRaw: 2n },
      ],
      6,
      9_007_199_254_740_994n,
    );
    expect(snapshot.entries.map((entry) => entry.wallet)).toEqual(['HUGE', 'MID', 'SMALL']);
  });

  it('formats supply percent and keeps wallets below the access threshold', () => {
    expect(formatSupplyPercent(25_400_000_000_000n, supplyRaw)).toBe('2.54%');
    expect(formatSupplyPercent(1n, supplyRaw)).toBe('<0.01%');
    const snapshot = aggregateHoldersByOwner(
      [{ address: 'tiny', owner: 'TINY', amountRaw: 1_000_000n }],
      6,
      supplyRaw,
    );
    expect(snapshot.entries[0]?.rank).toBe(1);
    expect(snapshot.entries[0]?.supplyPercent).toBe('<0.01%');
    expect(findWalletRankingEntry(snapshot, 'TINY')?.balanceUi).toBe('1');
  });
});
