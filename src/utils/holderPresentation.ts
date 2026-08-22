import { formatSupplyPercent } from './supplyPercent';
import { formatTokenAmount } from './tokenAmount';
import { findProjectWallet, isProjectWallet, projectWalletList, type ProjectWalletId } from '../config/projectWallets';
import type { HolderRankingEntry, HolderRankingSnapshot } from '../types';

export type ProjectAllocation = {
  id: ProjectWalletId;
  label: string;
  address: string;
  balanceRaw: string;
  balanceUi: string;
  supplyPercent: string;
};

export type HolderPresentation = {
  /** On-chain ranking including project wallets. Used for tokenomics, never discarded. */
  onChainEntries: HolderRankingEntry[];
  /** Community-only ranking with ranks recomputed after filtering project wallets. */
  communityEntries: HolderRankingEntry[];
  projectAllocations: ProjectAllocation[];
  communityHeldRaw: bigint;
  projectHeldRaw: bigint;
  communityHolderCount: number;
  projectSharePercent: string;
  communitySharePercent: string;
};

export function presentHolderRanking(
  snapshot: HolderRankingSnapshot | null,
  decimals: number,
  supplyRaw: bigint,
): HolderPresentation {
  const onChainEntries = snapshot?.entries ?? [];
  const balances = new Map(onChainEntries.map((entry) => [entry.wallet, BigInt(entry.balanceRaw)]));

  const communitySource = onChainEntries.filter((entry) => !isProjectWallet(entry.wallet));
  const communityEntries = communitySource.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));

  const projectAllocations = projectWalletList().map((wallet) => {
    const balanceRaw = balances.get(wallet.address) ?? 0n;
    return {
      id: wallet.id,
      label: wallet.label,
      address: wallet.address,
      balanceRaw: balanceRaw.toString(),
      balanceUi: formatTokenAmount(balanceRaw, decimals),
      supplyPercent: formatSupplyPercent(balanceRaw, supplyRaw),
    };
  });

  const communityHeldRaw = communityEntries.reduce((total, entry) => total + BigInt(entry.balanceRaw), 0n);
  const projectHeldRaw = projectAllocations.reduce((total, entry) => total + BigInt(entry.balanceRaw), 0n);

  return {
    onChainEntries,
    communityEntries,
    projectAllocations,
    communityHeldRaw,
    projectHeldRaw,
    communityHolderCount: communityEntries.length,
    projectSharePercent: formatSupplyPercent(projectHeldRaw, supplyRaw),
    communitySharePercent: formatSupplyPercent(communityHeldRaw, supplyRaw),
  };
}

export function findCommunityWalletRank(presentation: HolderPresentation, wallet: string | null): number | null {
  if (!wallet) return null;
  return presentation.communityEntries.find((entry) => entry.wallet === wallet)?.rank ?? null;
}

export function projectWalletLabel(address: string): string | null {
  return findProjectWallet(address)?.label ?? null;
}
