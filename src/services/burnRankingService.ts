import type {
  BurnRankingEntry,
  BurnRankingSnapshot,
  BurnRecord,
  RankingSourceKind,
} from '../types';
import { compareRawDesc, formatTokenAmount } from '../utils/tokenAmount';
import { projectWalletLabel } from '../utils/holderPresentation';
import { appConfig } from '../config/env';
import { fetchVerifiedBurnRecords } from './verifiedBurnClient';

export interface BurnRankingProvider {
  readonly kind: RankingSourceKind;
  readonly live: boolean;
  readonly disclaimer: string;
  fetchRecords(decimals: number): Promise<BurnRecord[]>;
}

export class EmptyBurnRankingProvider implements BurnRankingProvider {
  readonly kind = 'none' as const;
  readonly live = false;
  readonly disclaimer = 'Verified forest burns will appear here once burn indexing is enabled.';

  async fetchRecords(_decimals: number): Promise<BurnRecord[]> {
    return [];
  }
}

export class LocalVerifiedBurnsProvider implements BurnRankingProvider {
  readonly kind = 'local' as const;
  readonly live = true;
  readonly disclaimer = 'Verified on-chain MHOOD burns stored by the local Forest ledger.';

  async fetchRecords(decimals: number): Promise<BurnRecord[]> {
    const records = await fetchVerifiedBurnRecords();
    return records.map((record) => ({
      ...record,
      amountUi: formatTokenAmount(BigInt(record.amountRaw), decimals),
      simulated: false,
    }));
  }
}

export class IndexerBurnRankingProvider implements BurnRankingProvider {
  readonly kind = 'indexer' as const;
  readonly live = true;
  readonly disclaimer = 'Live burn ranking from indexed on-chain burn transactions.';

  constructor(private readonly endpoint: string) {}

  async fetchRecords(decimals: number): Promise<BurnRecord[]> {
    const response = await fetch(this.endpoint);
    if (!response.ok) {
      throw new Error(`Burn indexer returned ${response.status}`);
    }
    const payload = (await response.json()) as { records?: BurnRecord[] };
    if (!payload.records) {
      throw new Error('Burn indexer response is missing records[]');
    }
    return payload.records.map((record) => ({
      ...record,
      amountUi: formatTokenAmount(BigInt(record.amountRaw), decimals),
      simulated: false,
    }));
  }
}

export function aggregateBurnRecords(records: BurnRecord[], decimals: number): BurnRankingSnapshot {
  const byWallet = new Map<string, { total: bigint; burns: number; lastBurn: number | null }>();
  let totalBurned = 0n;
  const seen = new Set<string>();
  const uniqueRecords: BurnRecord[] = [];

  for (const record of records) {
    if (record.simulated) continue;
    if (seen.has(record.signature)) continue;
    seen.add(record.signature);
    uniqueRecords.push(record);
    const amount = BigInt(record.amountRaw);
    totalBurned += amount;
    const current = byWallet.get(record.wallet) ?? { total: 0n, burns: 0, lastBurn: null };
    current.total += amount;
    current.burns += 1;
    const stamp = record.timestamp ?? null;
    if (stamp != null && (current.lastBurn === null || stamp > current.lastBurn)) {
      current.lastBurn = stamp;
    }
    byWallet.set(record.wallet, current);
  }

  const entries: BurnRankingEntry[] = [...byWallet.entries()]
    .map(([wallet, stats]) => ({
      rank: 0,
      wallet,
      totalBurnedRaw: stats.total.toString(),
      totalBurnedUi: formatTokenAmount(stats.total, decimals),
      burns: stats.burns,
      lastBurn: stats.lastBurn,
      label: projectWalletLabel(wallet) ?? undefined,
    }))
    .sort((a, b) => {
      const cmp = compareRawDesc(BigInt(a.totalBurnedRaw), BigInt(b.totalBurnedRaw));
      return cmp !== 0 ? cmp : a.wallet.localeCompare(b.wallet);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const source: RankingSourceKind = uniqueRecords.length === 0 ? 'none' : 'local';

  return {
    entries,
    records: uniqueRecords,
    totalBurnedRaw: totalBurned.toString(),
    totalBurns: uniqueRecords.length,
    uniqueBurners: byWallet.size,
    source,
    live: uniqueRecords.length > 0,
    disclaimer:
      uniqueRecords.length > 0
        ? 'Verified on-chain MHOOD burns. Duplicate signatures are ignored.'
        : 'Verified forest burns will appear here once a burn is confirmed on-chain.',
    fetchedAt: Date.now(),
  };
}

export class BurnRankingService {
  constructor(private readonly provider: BurnRankingProvider) {}

  async getRanking(decimals: number): Promise<BurnRankingSnapshot> {
    const records = await this.provider.fetchRecords(decimals);
    return aggregateBurnRecords(records, decimals);
  }
}

export function createBurnRankingService(): BurnRankingService {
  if (appConfig.rankingSource === 'indexer' && appConfig.burnIndexerUrl) {
    return new BurnRankingService(new IndexerBurnRankingProvider(appConfig.burnIndexerUrl));
  }
  return new BurnRankingService(new LocalVerifiedBurnsProvider());
}

export function findBurnRank(snapshot: BurnRankingSnapshot | null, wallet: string | null): number | null {
  if (!snapshot || !wallet) return null;
  return snapshot.entries.find((entry) => entry.wallet === wallet)?.rank ?? null;
}

export function findWalletBurnedRaw(
  snapshot: BurnRankingSnapshot | null,
  wallet: string | null,
): bigint {
  if (!snapshot || !wallet) return 0n;
  const match = snapshot.entries.find((entry) => entry.wallet === wallet);
  return match ? BigInt(match.totalBurnedRaw) : 0n;
}
