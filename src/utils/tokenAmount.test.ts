import { describe, expect, it } from 'vitest';
import {
  formatTokenAmount,
  meetsThreshold,
  parseBurnAmountInput,
  parseUiInputToRaw,
  percentOf,
  rawAmountToUiString,
  uiAmountToRaw,
} from './tokenAmount';

describe('tokenAmount', () => {
  it('converts 1,000,000 UI tokens at 6 decimals without floating point', () => {
    expect(uiAmountToRaw('1000000', 6)).toBe(1_000_000_000_000n);
    expect(uiAmountToRaw('1,000,000', 6)).toBe(1_000_000_000_000n);
    expect(rawAmountToUiString(1_000_000_000_000n, 6)).toBe('1000000');
  });

  it('keeps fractional raw amounts exact', () => {
    expect(uiAmountToRaw('742381.5', 6)).toBe(742_381_500_000n);
    expect(formatTokenAmount(742_381_500_000n, 6)).toBe('742,381.5');
  });

  it('formats grouping for large balances', () => {
    expect(formatTokenAmount(4_820_000_000_000n, 6)).toBe('4,820,000');
  });

  it('compares holder threshold with bigint', () => {
    const threshold = uiAmountToRaw('1000000', 6);
    expect(meetsThreshold(uiAmountToRaw('999999.999999', 6), threshold)).toBe(false);
    expect(meetsThreshold(uiAmountToRaw('1000000', 6), threshold)).toBe(true);
    expect(meetsThreshold(uiAmountToRaw('4820000', 6), threshold)).toBe(true);
  });

  it('parses user input and percentage shortcuts', () => {
    expect(parseUiInputToRaw('250000', 6)).toBe(250_000_000_000n);
    expect(percentOf(1_000_000_000_000n, 25)).toBe(250_000_000_000n);
    expect(percentOf(1_000_000_000_000n, 100)).toBe(1_000_000_000_000n);
  });

  it('parses burn amounts with bigint and rejects unsafe input', () => {
    expect(parseBurnAmountInput('1', 6)).toBe(1_000_000n);
    expect(parseBurnAmountInput('10,000 MHOOD', 6)).toBe(10_000_000_000n);
    expect(parseBurnAmountInput('1.5', 6)).toBe(1_500_000n);
    expect(() => parseBurnAmountInput('1.1234567', 6)).toThrow(/decimal/i);
    expect(() => parseBurnAmountInput('0', 6)).toThrow(/greater than zero/i);
    expect(() => parseBurnAmountInput('-1', 6)).toThrow(/negative/i);
    expect(() => parseBurnAmountInput('', 6)).toThrow(/empty/i);
    expect(() => parseBurnAmountInput('11', 6, 10_000_000n)).toThrow(/exceeds/i);
  });

  it('rejects oversized fractional precision', () => {
    expect(() => uiAmountToRaw('1.1234567', 6)).toThrow(/decimal/i);
  });
});
