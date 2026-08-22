import { useMemo } from 'react';
import { findBurnRank, findWalletBurnedRaw } from '../../services/burnRankingService';
import { presentHolderRanking, findCommunityWalletRank } from '../../utils/holderPresentation';
import type { BurnRankingSnapshot, HolderRankingSnapshot, MintDetails, WalletMhoodBalance } from '../../types';
import { BurnPanel } from '../BurnPanel/BurnPanel';
import { BurnRanking } from '../BurnRanking/BurnRanking';
import { HolderRanking } from '../HolderRanking/HolderRanking';
import { TokenDistribution } from '../TokenDistribution/TokenDistribution';
import { WalletSummary } from './WalletSummary';
import { StatsCards } from '../Stats/StatsCards';

type ForestDashboardProps = {
  visible: boolean;
  mint: MintDetails;
  balance: WalletMhoodBalance;
  holderSnapshot: HolderRankingSnapshot | null;
  holderLoading: boolean;
  holderError: string | null;
  onRetryHolders: () => void;
  burnSnapshot: BurnRankingSnapshot | null;
  burnLoading: boolean;
  burnError: string | null;
  onRefreshAll: () => Promise<void>;
};

export function ForestDashboard({
  visible,
  mint,
  balance,
  holderSnapshot,
  holderLoading,
  holderError,
  onRetryHolders,
  burnSnapshot,
  burnLoading,
  burnError,
  onRefreshAll,
}: ForestDashboardProps) {
  const presentation = useMemo(
    () => presentHolderRanking(holderSnapshot, mint.decimals, mint.supplyRaw),
    [holderSnapshot, mint.decimals, mint.supplyRaw],
  );
  const communitySnapshot = holderSnapshot
    ? { ...holderSnapshot, entries: presentation.communityEntries }
    : null;

  if (!visible) return null;

  return (
    <div className="forest-ui">
      <div className="forest-stage forest-stage--identity">
        <header className="forest-header">
          <p className="forest-kicker">MoginHood</p>
          <h1>The Forest</h1>
        </header>
        <WalletSummary
          mint={mint}
          balance={balance}
          holderRank={findCommunityWalletRank(presentation, balance.wallet)}
          holderLoading={holderLoading}
          burnedRaw={findWalletBurnedRaw(burnSnapshot, balance.wallet)}
          burnRank={findBurnRank(burnSnapshot, balance.wallet)}
          rankingLive={Boolean(holderSnapshot?.live)}
        />
      </div>

      <div className="forest-stage forest-stage--stats">
        <StatsCards mint={mint} snapshot={burnSnapshot} wallet={balance.wallet} />
      </div>

      <div className="forest-stage forest-stage--holders">
        <HolderRanking
          snapshot={communitySnapshot}
          loading={holderLoading}
          error={holderError}
          currentWallet={balance.wallet}
          onRetry={onRetryHolders}
        />
      </div>

      <div className="forest-stage forest-stage--tokenomics">
        <TokenDistribution mint={mint} presentation={presentation} />
      </div>

      <div className="forest-stage forest-stage--burns">
        <div className="forest-columns">
          <BurnRanking
            snapshot={burnSnapshot}
            loading={burnLoading}
            error={burnError}
            currentWallet={balance.wallet}
          />
          <BurnPanel mint={mint} balance={balance} onRefreshAfterRealBurn={onRefreshAll} />
        </div>
      </div>
    </div>
  );
}
