import { COPY } from '../../config/constants';
import { shortenAddress } from '../../utils/format';
import { formatTokenAmount } from '../../utils/tokenAmount';
import type { HolderPresentation } from '../../utils/holderPresentation';
import type { MintDetails } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type TokenDistributionProps = {
  mint: MintDetails;
  presentation: HolderPresentation;
};

export function TokenDistribution({ mint, presentation }: TokenDistributionProps) {
  return (
    <ForestPanel eyebrow="What the grove set aside" title={COPY.distributionTitle}>
      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Community-held MHOOD</p>
          <p className="stat-value">{formatTokenAmount(presentation.communityHeldRaw, mint.decimals)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Project allocation</p>
          <p className="stat-value">{formatTokenAmount(presentation.projectHeldRaw, mint.decimals)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Community holders</p>
          <p className="stat-value">{presentation.communityHolderCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Project wallet share</p>
          <p className="stat-value">{presentation.projectSharePercent}</p>
        </article>
      </div>
      <div className="table-scroll">
        <table className="forest-table">
          <thead>
            <tr>
              <th>Allocation</th>
              <th>Wallet</th>
              <th>MHOOD</th>
              <th>% Supply</th>
            </tr>
          </thead>
          <tbody>
            {presentation.projectAllocations.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.label}</td>
                <td>{shortenAddress(entry.address, 4)}</td>
                <td>{entry.balanceUi}</td>
                <td>{entry.supplyPercent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="allocation-cards" data-testid="token-distribution-mobile">
        {presentation.projectAllocations.map((entry) => (
          <li key={entry.id} className="allocation-card">
            <p className="allocation-card__label">{entry.label}</p>
            <p className="allocation-card__wallet">{shortenAddress(entry.address, 4)}</p>
            <p className="allocation-card__amount">{entry.balanceUi} MHOOD</p>
            <p className="allocation-card__pct">{entry.supplyPercent}</p>
          </li>
        ))}
      </ul>
    </ForestPanel>
  );
}
