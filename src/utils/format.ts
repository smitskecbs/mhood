export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function explorerTxUrl(base: string, signature: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${signature}`;
}

export function holderTierFromBalance(balanceRaw: bigint, thresholdRaw: bigint): import('../types').HolderTier {
  if (balanceRaw >= thresholdRaw * 25n) return 'legend';
  if (balanceRaw >= thresholdRaw * 5n) return 'elder';
  if (balanceRaw >= thresholdRaw) return 'keeper';
  return 'wanderer';
}

export function formatTier(tier: import('../types').HolderTier): string {
  switch (tier) {
    case 'legend':
      return 'Legend';
    case 'elder':
      return 'Elder';
    case 'keeper':
      return 'Keeper';
    default:
      return 'Wanderer';
  }
}
