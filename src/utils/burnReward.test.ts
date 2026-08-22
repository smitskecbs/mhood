import { describe, expect, it } from 'vitest';
import { burnRewardThresholdRaw, qualifiesForBurnReward } from './burnReward';

describe('burn reward qualification helper', () => {
  it('requires at least 10,000 MHOOD in a single verified burn', () => {
    expect(burnRewardThresholdRaw(6)).toBe(10_000_000_000n);
    expect(qualifiesForBurnReward(9_999_999_999n, 6)).toBe(false);
    expect(qualifiesForBurnReward(10_000_000_000n, 6)).toBe(true);
    expect(qualifiesForBurnReward(25_000_000_000n, 6)).toBe(true);
  });
});
