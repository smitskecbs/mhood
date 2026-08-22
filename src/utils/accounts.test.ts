import { describe, expect, it } from 'vitest';
import { allocateBurnAcrossAccounts, sumTokenAccounts } from './accounts';

const DECIMALS = 1_000_000n;

describe('token account aggregation', () => {
  it('sums every token account for the same mint', () => {
    const total = sumTokenAccounts([
      { address: 'ata', amountRaw: 700_000_000_000n },
      { address: 'extra', amountRaw: 42_381_000_000n },
    ]);
    expect(total).toBe(742_381_000_000n);
  });

  it('uses a single token account when it can cover the burn', () => {
    expect(
      allocateBurnAcrossAccounts(
        [
          { address: 'small', amountRaw: 100n },
          { address: 'large', amountRaw: 800n },
          { address: 'mid', amountRaw: 200n },
        ],
        150n,
      ),
    ).toEqual([{ tokenAccount: 'mid', amountRaw: 150n }]);
  });

  it('splits a burn across accounts in listed order when none can cover it alone', () => {
    const allocations = allocateBurnAcrossAccounts(
      [
        { address: 'A', amountRaw: 7_000n * DECIMALS },
        { address: 'B', amountRaw: 8_000n * DECIMALS },
      ],
      10_000n * DECIMALS,
    );
    expect(allocations).toEqual([
      { tokenAccount: 'A', amountRaw: 7_000n * DECIMALS },
      { tokenAccount: 'B', amountRaw: 3_000n * DECIMALS },
    ]);
  });

  it('can burn the exact combined balance', () => {
    expect(
      allocateBurnAcrossAccounts(
        [
          { address: 'A', amountRaw: 4n },
          { address: 'B', amountRaw: 6n },
        ],
        10n,
      ),
    ).toEqual([
      { tokenAccount: 'A', amountRaw: 4n },
      { tokenAccount: 'B', amountRaw: 6n },
    ]);
  });

  it('skips frozen token accounts when allocating a burn', () => {
    expect(() =>
      allocateBurnAcrossAccounts(
        [{ address: 'frozen', amountRaw: 10n, state: 'frozen', spendable: false }],
        1n,
      ),
    ).toThrow(/Insufficient/);
    expect(
      allocateBurnAcrossAccounts(
        [
          { address: 'frozen', amountRaw: 10n, state: 'frozen', spendable: false },
          { address: 'live', amountRaw: 5n, state: 'initialized', spendable: true },
        ],
        5n,
      ),
    ).toEqual([{ tokenAccount: 'live', amountRaw: 5n }]);
  });

  it('refuses burns larger than the combined balance', () => {
    expect(() =>
      allocateBurnAcrossAccounts([{ address: 'ata', amountRaw: 10n }], 11n),
    ).toThrow(/Insufficient/);
  });
});
