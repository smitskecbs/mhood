import { describe, expect, it } from 'vitest';
import { MHOOD_ORIGINAL_SUPPLY_RAW } from '../config/constants';
import { formatTokenAmount } from './tokenAmount';
import { originalMhoodSupplyRaw, totalBurnedFromSupply } from './mhoodSupply';

describe('on-chain MHOOD supply tracking', () => {
  it('uses 1,000,000,000 MHOOD at 6 decimals as the original raw supply', () => {
    expect(originalMhoodSupplyRaw(6)).toBe(1_000_000_000n * 1_000_000n);
    expect(originalMhoodSupplyRaw()).toBe(MHOOD_ORIGINAL_SUPPLY_RAW);
    expect(MHOOD_ORIGINAL_SUPPLY_RAW).toBe(1_000_000_000_000_000n);
  });

  it('parses current supply with bigint precision', () => {
    const current = 999_999_998_000_000n;
    expect(current.toString()).toBe('999999998000000');
    expect(formatTokenAmount(current, 6)).toBe('999,999,998');
  });

  it('computes Total Burned as original 1B minus current 999,999,998 = 2 MHOOD', () => {
    const current = 999_999_998_000_000n;
    const burned = totalBurnedFromSupply(current);
    expect(burned).toBe(2_000_000n);
    expect(formatTokenAmount(burned, 6)).toBe('2');
    expect(originalMhoodSupplyRaw() - current).toBe(burned);
  });

  it('keeps burned supply math in bigint, never Number', () => {
    const current = 999_999_998_000_000n;
    const burned = totalBurnedFromSupply(current);
    expect(typeof burned).toBe('bigint');
    expect(burned).toBe(2_000_000n);
    expect(burned.toString()).toBe('2000000');
  });
});
