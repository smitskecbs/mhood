import { COPY } from '../../config/constants';
import { HOLDER_RANKING_VISIBLE_TOP } from '../../config/timing';
import { shortenAddress } from '../../utils/format';
import { findWalletRankingEntry } from '../../utils/holderAggregation';
import { shouldShowYourPositionCard, visibleCommunityLeaderboard } from '../../utils/holderPresentation';
import type { HolderRankingSnapshot } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type HolderRankingProps = {
  snapshot: HolderRankingSnapshot | null;
  loading: boolean;
  error: string | null;
  currentWallet: string | null;
  onRetry: () => void;
};

export function HolderRanking({
  snapshot,
  loading,
  error,
  currentWallet,
  onRetry,
}: HolderRankingProps) {
  const visible = visibleCommunityLeaderboard(snapshot?.entries ?? [], HOLDER_RANKING_VISIBLE_TOP);
  const you = findWalletRankingEntry(snapshot, currentWallet);
  const showYouOutsideTop = shouldShowYourPositionCard(visible, you);

  return (
    <ForestPanel eyebrow="Those who remain" title={COPY.holdersTitle}>
      {loading ? (
        <p className="ledger-reading" aria-live="polite">
          {COPY.ledgerReading}
        </p>
      ) : null}
      {error ? (
        <div className="ranking-error">
          <p className="gate-error">{error}</p>
          <button type="button" className="forest-button forest-button--ghost" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {!loading && !error && snapshot ? (
        <>
          <p className="holders-caption">{COPY.holdersTopCaption}</p>
          <div className="table-scroll">
            <table className="forest-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wallet</th>
                  <th>MHOOD</th>
                  <th>% Supply</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.wallet} className={entry.wallet === currentWallet ? 'is-you' : undefined}>
                    <td>#{entry.rank}</td>
                    <td>{shortenAddress(entry.wallet, 4)}</td>
                    <td>{entry.balanceUi} MHOOD</td>
                    <td>{entry.supplyPercent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="ranking-cards" data-testid="holder-ranking-mobile">
            {visible.map((entry) => (
              <li
                key={entry.wallet}
                className={`ranking-card${entry.wallet === currentWallet ? ' is-you' : ''}`}
              >
                <p className="ranking-card__rank">#{entry.rank}</p>
                <p className="ranking-card__wallet">{shortenAddress(entry.wallet, 4)}</p>
                <p className="ranking-card__amount">{entry.balanceUi} MHOOD</p>
                <p className="ranking-card__pct">{entry.supplyPercent}</p>
              </li>
            ))}
          </ol>
          {showYouOutsideTop && you ? (
            <div className="your-position forest-pop" data-testid="your-position">
              <p className="forest-panel__eyebrow">{COPY.yourPosition}</p>
              <p className="your-position__rank">#{you.rank}</p>
              <p className="your-position__wallet">{shortenAddress(you.wallet, 4)}</p>
              <p className="your-position__amount">{you.balanceUi} MHOOD</p>
              <p className="your-position__pct">{you.supplyPercent}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </ForestPanel>
  );
}
