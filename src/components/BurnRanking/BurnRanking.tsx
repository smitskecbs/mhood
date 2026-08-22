import { COPY } from '../../config/constants';
import { shortenAddress } from '../../utils/format';
import type { BurnRankingSnapshot } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type BurnRankingProps = {
  snapshot: BurnRankingSnapshot | null;
  loading: boolean;
  error: string | null;
  currentWallet: string | null;
};

export function BurnRanking({ snapshot, loading, error, currentWallet }: BurnRankingProps) {
  const entries = snapshot?.entries ?? [];

  return (
    <ForestPanel eyebrow="What was given back" title={COPY.legendsTitle}>
      {loading ? <p className="muted">Listening for ash…</p> : null}
      {error ? <p className="gate-error">{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <p className="muted">
          {snapshot?.persistence === 'inactive' ? COPY.legendsPersistenceInactive : COPY.noBurns}
        </p>
      ) : null}
      {entries.length > 0 ? (
        <div className="table-scroll">
          <table className="forest-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wallet</th>
                  <th>Total Burned</th>
                  <th>Burns</th>
                  <th>Last Burn</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.wallet} className={entry.wallet === currentWallet ? 'is-you' : undefined}>
                    <td>#{entry.rank}</td>
                    <td>
                      {shortenAddress(entry.wallet, 4)}
                      {entry.label ? <span className="wallet-label"> {entry.label}</span> : null}
                    </td>
                    <td>{entry.totalBurnedUi}</td>
                    <td>{entry.burns}</td>
                    <td>{entry.lastBurn ? new Date(entry.lastBurn * 1000).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </ForestPanel>
  );
}
