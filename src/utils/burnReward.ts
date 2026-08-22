/** One verified burn of this UI amount may later qualify for an NFT reward. No minting here. */
export const BURN_REWARD_THRESHOLD_UI = '10000';

export function burnRewardThresholdRaw(decimals = 6): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`Unsupported decimals: ${decimals}`);
  }
  return 10_000n * 10n ** BigInt(decimals);
}

export function qualifiesForBurnReward(amountRaw: bigint, decimals = 6): boolean {
  return amountRaw >= burnRewardThresholdRaw(decimals);
}
