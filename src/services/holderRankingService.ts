import type { HolderRankingEntry, HolderRankingSnapshot, MintDetails, RankingSourceKind } from '../types';
import { holderTierFromBalance } from '../utils/format';
import { compareRawDesc, formatTokenAmount, uiAmountToRaw } from '../utils/tokenAmount';
import { formatSupplyPercent } from '../utils/supplyPercent';
import { aggregateHoldersByOwner, findWalletRank, findWalletRankingEntry } from '../utils/holderAggregation';
import { fetchAllMintTokenAccounts } from './solana/heliusTokenAccounts';
import { appConfig, requireConfiguredRpcUrl } from '../config/env';
import { HOLDER_RANKING_CACHE_MS } from '../config/timing';
import { MOCK_DATA_DISCLAIMER, MOCK_HOLDER_WALLETS } from './providers/devMockData';
import { devLog } from '../utils/devLog';

export { findWalletRank, findWalletRankingEntry };

export interface HolderRankingProvider {
  readonly kind: RankingSourceKind;
  readonly live: boolean;
  readonly disclaimer: string;
  fetchHolders(mint: MintDetails): Promise<HolderRankingEntry[]>;
}

/** Test-only fixture provider. Never used by the live app. */
export class MockHolderRankingProvider implements HolderRankingProvider {
  readonly kind = 'mock' as const;
  readonly live = false;
  readonly disclaimer = MOCK_DATA_DISCLAIMER;

  async fetchHolders(mint: MintDetails): Promise<HolderRankingEntry[]> {
    const thresholdRaw = uiAmountToRaw(appConfig.accessThresholdUi, mint.decimals);
    return MOCK_HOLDER_WALLETS.map((row, index) => {
      const balanceRaw = uiAmountToRaw(row.ui, mint.decimals);
      return {
        rank: index + 1,
        wallet: row.wallet,
        balanceRaw: balanceRaw.toString(),
        balanceUi: formatTokenAmount(balanceRaw, mint.decimals),
        supplyPercent: formatSupplyPercent(balanceRaw, mint.supplyRaw),
        tier: holderTierFromBalance(balanceRaw, thresholdRaw),
      };
    });
  }
}

export class RpcHolderRankingProvider implements HolderRankingProvider {
  readonly kind = 'rpc' as const;
  readonly live = true;
  readonly disclaimer = 'Live MHOOD holder snapshot from the configured mainnet RPC.';

  async fetchHolders(mint: MintDetails): Promise<HolderRankingEntry[]> {
    requireConfiguredRpcUrl();
    const accounts = await fetchAllMintTokenAccounts({ mint: mint.mint });
    const snapshot = aggregateHoldersByOwner(accounts, mint.decimals, mint.supplyRaw);
    devLog(`unique holders: ${snapshot.entries.length}`);
    return snapshot.entries;
  }
}

function rankHolders(entries: HolderRankingEntry[]): HolderRankingEntry[] {
  return [...entries]
    .sort((a, b) => compareRawDesc(BigInt(a.balanceRaw), BigInt(b.balanceRaw)))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

type RankingCache = {
  mint: string;
  snapshot: HolderRankingSnapshot;
};

let rankingCache: RankingCache | null = null;

export function resetHolderRankingCache(): void {
  rankingCache = null;
}

export class HolderRankingService {
  constructor(private readonly provider: HolderRankingProvider) {}

  async getRanking(mint: MintDetails, options?: { bypassCache?: boolean }): Promise<HolderRankingSnapshot> {
    if (
      !options?.bypassCache &&
      rankingCache &&
      rankingCache.mint === mint.mint &&
      Date.now() - rankingCache.snapshot.fetchedAt < HOLDER_RANKING_CACHE_MS
    ) {
      return rankingCache.snapshot;
    }

    const entries = rankHolders(await this.provider.fetchHolders(mint));
    const snapshot: HolderRankingSnapshot = {
      entries,
      source: this.provider.kind,
      live: this.provider.live,
      disclaimer: this.provider.disclaimer,
      fetchedAt: Date.now(),
    };
    rankingCache = { mint: mint.mint, snapshot };
    return snapshot;
  }
}

export function createHolderRankingService(): HolderRankingService {
  return new HolderRankingService(new RpcHolderRankingProvider());
}
