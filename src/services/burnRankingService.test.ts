import { describe, expect, it } from 'vitest';
import {
  aggregateBurnRecords,
  compareBurnRankingEntries,
  findBurnRank,
  findWalletBurnCount,
  findWalletBurnedRaw,
} from './burnRankingService';
import { PROJECT_WALLETS } from '../config/projectWallets';
import { formatTokenAmount } from '../utils/tokenAmount';
import type { BurnRecord } from '../types';

const MINT = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';
const ONE_MHOOD = 1_000_000n;

function record(input: {
  signature: string;
  wallet: string;
  amountRaw: bigint;
  slot?: number;
  simulated?: boolean;
}): BurnRecord {
  return {
    signature: input.signature,
    wallet: input.wallet,
    mint: MINT,
    amountRaw: input.amountRaw.toString(),
    amountUi: formatTokenAmount(input.amountRaw, 6),
    slot: input.slot ?? 1,
    timestamp: input.slot ?? 1,
    simulated: input.simulated,
  };
}

describe('burnRankingService', () => {
  it('aggregates verifiable burn records by wallet', () => {
    const snapshot = aggregateBurnRecords(
      [
        {
          signature: 'sig-a',
          wallet: 'WALLET_A',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1000',
          amountUi: '0.001',
          slot: 1,
          timestamp: 10,
        },
        {
          signature: 'sig-b',
          wallet: 'WALLET_B',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '2500',
          amountUi: '0.0025',
          slot: 2,
          timestamp: 20,
        },
        {
          signature: 'sig-c',
          wallet: 'WALLET_A',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '500',
          amountUi: '0.0005',
          slot: 3,
          timestamp: 30,
        },
        {
          signature: 'sig-a',
          wallet: 'WALLET_A',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1000',
          amountUi: '0.001',
          slot: 1,
          timestamp: 10,
        },
      ],
      6,
    );

    expect(snapshot.totalBurns).toBe(3);
    expect(snapshot.uniqueBurners).toBe(2);
    expect(snapshot.totalBurnedRaw).toBe('4000');
    expect(snapshot.entries[0]?.wallet).toBe('WALLET_B');
    expect(snapshot.entries[1]?.burns).toBe(2);
    expect(snapshot.entries[1]?.lastBurn).toBe(30);
    expect(findBurnRank(snapshot, 'WALLET_A')).toBe(2);
    expect(findWalletBurnedRaw(snapshot, 'WALLET_A')).toBe(1500n);
  });

  it('aggregates two 1 MHOOD burns from the same wallet as 2 MHOOD and rank 1', () => {
    const snapshot = aggregateBurnRecords(
      [
        {
          signature: 'sig-1',
          wallet: 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1000000',
          amountUi: '1',
          slot: 1,
          timestamp: 10,
        },
        {
          signature: 'sig-2',
          wallet: 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1000000',
          amountUi: '1',
          slot: 2,
          timestamp: 20,
        },
      ],
      6,
    );
    expect(snapshot.totalBurnedRaw).toBe('2000000');
    expect(snapshot.totalBurns).toBe(2);
    expect(snapshot.uniqueBurners).toBe(1);
    expect(snapshot.entries[0]?.burns).toBe(2);
    expect(snapshot.entries[0]?.rank).toBe(1);
    expect(findBurnRank(snapshot, 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY')).toBe(1);
    expect(findWalletBurnedRaw(snapshot, 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY')).toBe(2_000_000n);
    expect(findWalletBurnCount(snapshot, 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY')).toBe(2);
  });

  it('does not invent per-wallet leaderboard records from global supply', () => {
    const snapshot = aggregateBurnRecords([], 6);
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.records).toEqual([]);
    expect(snapshot.source).toBe('none');
  });

  it('ignores simulated records and labels known project wallets', () => {
    const snapshot = aggregateBurnRecords(
      [
        {
          signature: 'SIM_NOT_ONCHAIN',
          wallet: 'MOCK',
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1',
          amountUi: '0.000001',
          slot: 0,
          timestamp: null,
          simulated: true,
        },
        {
          signature: 'real-1',
          wallet: PROJECT_WALLETS.treasury.address,
          mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
          amountRaw: '1000000',
          amountUi: '1',
          slot: 9,
          timestamp: 99,
        },
      ],
      6,
    );
    expect(snapshot.totalBurns).toBe(1);
    expect(snapshot.entries[0]?.label).toBe('Treasury');
    expect(snapshot.source).toBe('local');
  });

  it('aggregates one 1 MHOOD burn as total 1 and count 1', () => {
    const snapshot = aggregateBurnRecords(
      [record({ signature: 'sig-a', wallet: 'WALLET_A', amountRaw: ONE_MHOOD })],
      6,
    );
    expect(findWalletBurnedRaw(snapshot, 'WALLET_A')).toBe(ONE_MHOOD);
    expect(findWalletBurnCount(snapshot, 'WALLET_A')).toBe(1);
    expect(snapshot.entries[0]?.totalBurnedUi).toBe('1');
  });

  it('aggregates five unique 1 MHOOD burns as total 5 and count 5', () => {
    const snapshot = aggregateBurnRecords(
      Array.from({ length: 5 }, (_, index) =>
        record({
          signature: `sig-b-${index}`,
          wallet: 'WALLET_B',
          amountRaw: ONE_MHOOD,
          slot: index + 1,
        }),
      ),
      6,
    );
    expect(findWalletBurnedRaw(snapshot, 'WALLET_B')).toBe(5n * ONE_MHOOD);
    expect(findWalletBurnCount(snapshot, 'WALLET_B')).toBe(5);
    expect(snapshot.entries[0]?.totalBurnedUi).toBe('5');
    expect(snapshot.totalBurns).toBe(5);
  });

  it('does not copy the global burned total onto every wallet', () => {
    const snapshot = aggregateBurnRecords(
      [
        record({ signature: 'sig-a', wallet: 'WALLET_A', amountRaw: ONE_MHOOD }),
        record({ signature: 'sig-b1', wallet: 'WALLET_B', amountRaw: ONE_MHOOD, slot: 2 }),
        record({ signature: 'sig-b2', wallet: 'WALLET_B', amountRaw: ONE_MHOOD, slot: 3 }),
        record({ signature: 'sig-b3', wallet: 'WALLET_B', amountRaw: ONE_MHOOD, slot: 4 }),
        record({ signature: 'sig-b4', wallet: 'WALLET_B', amountRaw: ONE_MHOOD, slot: 5 }),
        record({ signature: 'sig-b5', wallet: 'WALLET_B', amountRaw: ONE_MHOOD, slot: 6 }),
      ],
      6,
    );
    expect(snapshot.totalBurnedRaw).toBe((6n * ONE_MHOOD).toString());
    expect(findWalletBurnedRaw(snapshot, 'WALLET_A')).toBe(ONE_MHOOD);
    expect(findWalletBurnCount(snapshot, 'WALLET_A')).toBe(1);
    expect(findWalletBurnedRaw(snapshot, 'WALLET_B')).toBe(5n * ONE_MHOOD);
    expect(findWalletBurnCount(snapshot, 'WALLET_B')).toBe(5);
  });

  it('counts unique signatures only and converts raw amounts with mint decimals', () => {
    const snapshot = aggregateBurnRecords(
      [
        record({ signature: 'dup', wallet: 'WALLET_A', amountRaw: ONE_MHOOD }),
        record({ signature: 'dup', wallet: 'WALLET_A', amountRaw: 9n * ONE_MHOOD, slot: 2 }),
        record({ signature: 'other', wallet: 'WALLET_A', amountRaw: 500_000n, slot: 3 }),
      ],
      6,
    );
    expect(snapshot.totalBurns).toBe(2);
    expect(findWalletBurnCount(snapshot, 'WALLET_A')).toBe(2);
    expect(findWalletBurnedRaw(snapshot, 'WALLET_A')).toBe(1_500_000n);
    expect(snapshot.entries[0]?.totalBurnedUi).toBe('1.5');
  });

  it('ranks equal burned totals by burn count, then wallet address', () => {
    expect(
      compareBurnRankingEntries(
        { totalBurnedRaw: '5000000', burns: 5, wallet: 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY' },
        { totalBurnedRaw: '5000000', burns: 1, wallet: PROJECT_WALLETS.treasury.address },
      ),
    ).toBeLessThan(0);

    const snapshot = aggregateBurnRecords(
      [
        record({ signature: 'treasury', wallet: PROJECT_WALLETS.treasury.address, amountRaw: 5n * ONE_MHOOD }),
        record({ signature: 'dev', wallet: PROJECT_WALLETS.dev.address, amountRaw: 5n * ONE_MHOOD, slot: 2 }),
        ...Array.from({ length: 5 }, (_, index) =>
          record({
            signature: `meme-${index}`,
            wallet: 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY',
            amountRaw: ONE_MHOOD,
            slot: index + 10,
          }),
        ),
      ],
      6,
    );
    expect(snapshot.entries.map((entry) => [entry.wallet, entry.totalBurnedUi, entry.burns, entry.label])).toEqual([
      ['memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY', '5', 5, undefined],
      [PROJECT_WALLETS.treasury.address, '5', 1, 'Treasury'],
      [PROJECT_WALLETS.dev.address, '5', 1, 'Dev Wallet'],
    ]);
    expect(snapshot.entries[1]?.label).toBe('Treasury');
    expect(findWalletBurnedRaw(snapshot, PROJECT_WALLETS.treasury.address)).toBe(5n * ONE_MHOOD);
  });

  it('still ranks a larger burned total above more burns of a smaller total', () => {
    const snapshot = aggregateBurnRecords(
      [
        record({ signature: 'six', wallet: 'WALLET_SIX', amountRaw: 6n * ONE_MHOOD }),
        ...Array.from({ length: 5 }, (_, index) =>
          record({
            signature: `five-${index}`,
            wallet: 'WALLET_FIVE',
            amountRaw: ONE_MHOOD,
            slot: index + 2,
          }),
        ),
      ],
      6,
    );
    expect(snapshot.entries[0]?.wallet).toBe('WALLET_SIX');
    expect(snapshot.entries[0]?.burns).toBe(1);
    expect(snapshot.entries[1]?.wallet).toBe('WALLET_FIVE');
    expect(snapshot.entries[1]?.burns).toBe(5);
  });

  it('does not change aggregation when a project-wallet label is present', () => {
    const snapshot = aggregateBurnRecords(
      [record({ signature: 'treasury-1', wallet: PROJECT_WALLETS.treasury.address, amountRaw: ONE_MHOOD })],
      6,
    );
    expect(snapshot.entries[0]?.label).toBe('Treasury');
    expect(snapshot.entries[0]?.totalBurnedUi).toBe('1');
    expect(snapshot.entries[0]?.burns).toBe(1);
  });
});
