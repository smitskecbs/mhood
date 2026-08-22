import { MHOOD_DECIMALS, MHOOD_ORIGINAL_SUPPLY_RAW } from '../config/constants';
import { formatTokenAmount } from './tokenAmount';

export function originalMhoodSupplyRaw(decimals = MHOOD_DECIMALS): bigint {
  if (decimals === MHOOD_DECIMALS) return MHOOD_ORIGINAL_SUPPLY_RAW;
  return 1_000_000_000n * 10n ** BigInt(decimals);
}

export function totalBurnedFromSupply(
  currentSupplyRaw: bigint,
  originalSupplyRaw = MHOOD_ORIGINAL_SUPPLY_RAW,
): bigint {
  if (currentSupplyRaw < 0n) {
    throw new Error('Current supply cannot be negative');
  }
  if (currentSupplyRaw > originalSupplyRaw) {
    return 0n;
  }
  return originalSupplyRaw - currentSupplyRaw;
}

export function indexedBurnGapMessage(
  onChainRaw: bigint,
  indexedRaw: bigint,
  decimals: number,
): string | null {
  if (indexedRaw >= onChainRaw) return null;
  return `${formatTokenAmount(onChainRaw, decimals)} MHOOD burned on-chain · ${formatTokenAmount(indexedRaw, decimals)} MHOOD indexed`;
}
