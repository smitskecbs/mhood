import { useWallet } from '@solana/wallet-adapter-react';
import { formatTokenAmount } from '../../utils/tokenAmount';
import { shortenAddress } from '../../utils/format';
import type { MintDetails, WalletMhoodBalance } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';

type WalletSummaryProps = {
  mint: MintDetails;
  balance: WalletMhoodBalance;
  holderRank: number | null;
  holderLoading: boolean;
  burnedRaw: bigint;
  burnRank: number | null;
  rankingLive: boolean;
};

function RankValue({
  rank,
  live,
  loading = false,
  unranked = '—',
}: {
  rank: number | null;
  live: boolean;
  loading?: boolean;
  unranked?: string;
}) {
  if (loading) return <span className="muted">…</span>;
  if (rank != null) return <span>#{rank}</span>;
  if (live && unranked !== '—') return <span className="muted">{unranked}</span>;
  return <span>—</span>;
}

export function WalletSummary({
  mint,
  balance,
  holderRank,
  holderLoading,
  burnedRaw,
  burnRank,
  rankingLive,
}: WalletSummaryProps) {
  const { disconnect } = useWallet();

  return (
    <ForestPanel className="wallet-summary" eyebrow="Your place in the trees">
      <div className="wallet-summary__grid">
        <div>
          <p className="stat-label">Wallet</p>
          <p className="stat-value">{shortenAddress(balance.wallet)}</p>
        </div>
        <div>
          <p className="stat-label">Balance</p>
          <p className="stat-value">{formatTokenAmount(balance.totalRaw, mint.decimals)} MHOOD</p>
        </div>
        <div>
          <p className="stat-label">Holder Rank</p>
          <p className="stat-value">
            <RankValue rank={holderRank} live={rankingLive} loading={holderLoading} unranked="Unranked" />
          </p>
        </div>
        <div>
          <p className="stat-label">Burned</p>
          <p className="stat-value">{formatTokenAmount(burnedRaw, mint.decimals)} MHOOD</p>
        </div>
        <div>
          <p className="stat-label">Burn Rank</p>
          <p className="stat-value">
            <RankValue rank={burnRank} live={false} />
          </p>
        </div>
      </div>
      <button type="button" className="forest-button forest-button--ghost" onClick={() => void disconnect()}>
        Leave the forest
      </button>
    </ForestPanel>
  );
}
