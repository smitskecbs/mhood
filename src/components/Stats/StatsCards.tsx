import { formatTokenAmount } from '../../utils/tokenAmount';
import { totalBurnedFromSupply } from '../../utils/mhoodSupply';
import type { BurnRankingSnapshot, MintDetails } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type StatsCardsProps = {
  mint: MintDetails;
  snapshot: BurnRankingSnapshot | null;
  wallet: string | null;
};

export function StatsCards({ mint, snapshot, wallet }: StatsCardsProps) {
  const currentSupply = mint.supplyRaw;
  const totalBurned = totalBurnedFromSupply(currentSupply);
  const leaderboardReady = snapshot != null && snapshot.persistence !== 'inactive';
  const yourRank = leaderboardReady
    ? snapshot.entries.find((entry) => entry.wallet === wallet)?.rank ?? null
    : null;

  return (
    <ForestPanel eyebrow="The grove keeps count" title="Forest memory">
      <div className="stats-grid stats-grid--grove">
        <article className="stat-card">
          <p className="stat-label">Current Supply</p>
          <p className="stat-value">{formatTokenAmount(currentSupply, mint.decimals)} MHOOD</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total MHOOD Burned</p>
          <p className="stat-value">{formatTokenAmount(totalBurned, mint.decimals)} MHOOD</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total Burns</p>
          <p className="stat-value">{leaderboardReady ? snapshot.totalBurns : '—'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Unique Burners</p>
          <p className="stat-value">{leaderboardReady ? snapshot.uniqueBurners : '—'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Your Burn Rank</p>
          <p className="stat-value">{yourRank ? `#${yourRank}` : '—'}</p>
        </article>
      </div>
    </ForestPanel>
  );
}
