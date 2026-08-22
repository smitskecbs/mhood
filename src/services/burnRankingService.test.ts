import { describe, expect, it } from 'vitest';
import { aggregateBurnRecords, findBurnRank, findWalletBurnedRaw } from './burnRankingService';
import { PROJECT_WALLETS } from '../config/projectWallets';

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

  it('labels empty burn records as unavailable instead of mock data', () => {
    const snapshot = aggregateBurnRecords([], 6);
    expect(snapshot.live).toBe(false);
    expect(snapshot.source).toBe('none');
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.totalBurns).toBe(0);
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
});
