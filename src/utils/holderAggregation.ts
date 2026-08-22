import { compareRawDesc, formatTokenAmount } from '../utils/tokenAmount';
import { formatSupplyPercent, parseTokenAmountToRaw } from '../utils/supplyPercent';
import type { HolderRankingEntry, HolderRankingSnapshot } from '../types';

export type MintTokenAccountRow = {
  address: string;
  owner: string;
  amountRaw: bigint;
};

export function normalizeMintTokenAccount(row: {
  address?: unknown;
  owner?: unknown;
  amount?: unknown;
  burnt?: unknown;
}): MintTokenAccountRow | null {
  if (row.burnt === true) return null;
  const address = typeof row.address === 'string' ? row.address : '';
  const owner = typeof row.owner === 'string' ? row.owner : '';
  if (!address || !owner) return null;
  const amountRaw = parseTokenAmountToRaw(row.amount ?? 0);
  return { address, owner, amountRaw };
}

export function aggregateHoldersByOwner(
  accounts: MintTokenAccountRow[],
  decimals: number,
  supplyRaw: bigint,
): HolderRankingSnapshot {
  const seenAccounts = new Set<string>();
  const totals = new Map<string, bigint>();

  for (const account of accounts) {
    if (seenAccounts.has(account.address)) continue;
    seenAccounts.add(account.address);
    if (account.amountRaw <= 0n) continue;
    totals.set(account.owner, (totals.get(account.owner) ?? 0n) + account.amountRaw);
  }

  const entries: HolderRankingEntry[] = [...totals.entries()]
    .filter(([, balanceRaw]) => balanceRaw > 0n)
    .sort((a, b) => {
      const cmp = compareRawDesc(a[1], b[1]);
      return cmp !== 0 ? cmp : a[0].localeCompare(b[0]);
    })
    .map(([wallet, balanceRaw], index) => ({
      rank: index + 1,
      wallet,
      balanceRaw: balanceRaw.toString(),
      balanceUi: formatTokenAmount(balanceRaw, decimals),
      supplyPercent: formatSupplyPercent(balanceRaw, supplyRaw),
    }));

  return {
    entries,
    source: 'rpc',
    live: true,
    disclaimer: 'Live MHOOD holder snapshot from the configured mainnet RPC.',
    fetchedAt: Date.now(),
  };
}

export function findWalletRank(
  snapshot: HolderRankingSnapshot | null,
  wallet: string | null,
): number | null {
  if (!snapshot || !wallet) return null;
  return snapshot.entries.find((entry) => entry.wallet === wallet)?.rank ?? null;
}

export function findWalletRankingEntry(
  snapshot: HolderRankingSnapshot | null,
  wallet: string | null,
): HolderRankingEntry | null {
  if (!snapshot || !wallet) return null;
  return snapshot.entries.find((entry) => entry.wallet === wallet) ?? null;
}
