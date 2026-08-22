import { formatTokenAmount } from '../../utils/tokenAmount';
import { indexedBurnGapMessage, totalBurnedFromSupply } from '../../utils/mhoodSupply';
import type { BurnRankingSnapshot, MintDetails } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type StatsCardsProps = {
  mint: MintDetails;
  snapshot: BurnRankingSnapshot | null;
};

export function StatsCards({ mint, snapshot }: StatsCardsProps) {
  const currentSupply = mint.supplyRaw;
  const onChainBurned = totalBurnedFromSupply(currentSupply);
  const indexed = snapshot != null && snapshot.persistence !== 'inactive';
  const indexedBurnedRaw = indexed ? BigInt(snapshot.totalBurnedRaw) : 0n;
  const gap = indexed ? indexedBurnGapMessage(onChainBurned, indexedBurnedRaw, mint.decimals) : null;

  return (
    <ForestPanel eyebrow="The grove keeps count" title="Forest memory">
      <div className="stats-grid stats-grid--grove">
        <article className="stat-card">
          <p className="stat-label">Current Supply</p>
          <p className="stat-value">{formatTokenAmount(currentSupply, mint.decimals)} MHOOD</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total Burned</p>
          <p className="stat-value">{formatTokenAmount(onChainBurned, mint.decimals)} MHOOD</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Indexed Burn Amount</p>
          <p className="stat-value">
            {indexed ? `${formatTokenAmount(indexedBurnedRaw, mint.decimals)} MHOOD` : '—'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total Burn Transactions</p>
          <p className="stat-value">{indexed ? snapshot.totalBurns : '—'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Unique Burners</p>
          <p className="stat-value">{indexed ? snapshot.uniqueBurners : '—'}</p>
        </article>
      </div>
      {gap ? <p className="muted stats-gap">{gap}</p> : null}
    </ForestPanel>
  );
}
