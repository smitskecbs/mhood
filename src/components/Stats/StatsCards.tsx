import { formatTokenAmount } from '../../utils/tokenAmount';
import type { BurnRankingSnapshot, MintDetails } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type StatsCardsProps = {
  mint: MintDetails;
  snapshot: BurnRankingSnapshot | null;
  wallet: string | null;
};

export function StatsCards({ mint, snapshot, wallet }: StatsCardsProps) {
  const yourRank = snapshot?.entries.find((entry) => entry.wallet === wallet)?.rank ?? null;

  return (
    <ForestPanel eyebrow="The grove keeps count" title="Forest memory">
      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Total MHOOD Burned</p>
          <p className="stat-value">
            {snapshot ? formatTokenAmount(BigInt(snapshot.totalBurnedRaw), mint.decimals) : '—'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total Burns</p>
          <p className="stat-value">{snapshot ? snapshot.totalBurns : '—'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Unique Burners</p>
          <p className="stat-value">{snapshot ? snapshot.uniqueBurners : '—'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Your Burn Rank</p>
          <p className="stat-value">{yourRank ? `#${yourRank}` : '—'}</p>
        </article>
      </div>
    </ForestPanel>
  );
}
