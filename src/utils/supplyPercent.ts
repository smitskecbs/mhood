import { formatTokenAmount } from './tokenAmount';

/**
 * Two-decimal percent of supply using integer math.
 * Values below 0.01% of supply render as `<0.01%`.
 */
export function formatSupplyPercent(balanceRaw: bigint, supplyRaw: bigint): string {
  if (supplyRaw <= 0n || balanceRaw <= 0n) return '0%';
  const hundredths = (balanceRaw * 10_000n) / supplyRaw;
  if (hundredths === 0n) return '<0.01%';
  const whole = hundredths / 100n;
  const fraction = hundredths % 100n;
  return `${whole}.${fraction.toString().padStart(2, '0')}%`;
}

export function parseTokenAmountToRaw(value: unknown): bigint {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`Token amount is not an integer string: ${value}`);
    }
    return BigInt(trimmed);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Token amount must be a safe integer from RPC, not a JS float');
    }
    return BigInt(value);
  }
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error('Negative token amounts are not supported');
    return value;
  }
  throw new Error('Could not parse token account amount');
}

export { formatTokenAmount };
