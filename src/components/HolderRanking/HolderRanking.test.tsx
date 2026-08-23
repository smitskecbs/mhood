import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HolderRanking } from './HolderRanking';
import { COPY } from '../../config/constants';
import type { HolderRankingEntry, HolderRankingSnapshot } from '../../types';

const YOU = 'YouWallet11111111111111111111111111';

const snapshot: HolderRankingSnapshot = {
  live: true,
  source: 'rpc',
  disclaimer: 'Live MHOOD holder snapshot from the configured mainnet RPC.',
  fetchedAt: 0,
  entries: [
    {
      rank: 1,
      wallet: '11111111111111111111111111111111',
      balanceRaw: '25400000000000',
      balanceUi: '25,400,000',
      supplyPercent: '2.54%',
    },
    {
      rank: 284,
      wallet: YOU,
      balanceRaw: '1250000000000',
      balanceUi: '1,250,000',
      supplyPercent: '0.12%',
    },
  ],
};

function communityHolders(count: number, youRank?: number): HolderRankingEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    return {
      rank,
      wallet: rank === youRank ? YOU : `Holder${rank.toString().padStart(3, '0')}111111111111111111111111`,
      balanceRaw: String(10_000 - rank),
      balanceUi: String(10_000 - rank),
      supplyPercent: rank === 1 ? '2.54%' : '0.01%',
    };
  });
}

describe('HolderRanking', () => {
  it('renders live ranking columns without mock data', () => {
    render(
      <HolderRanking
        snapshot={snapshot}
        loading={false}
        error={null}
        currentWallet={YOU}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('FOREST HOLDERS')).toBeInTheDocument();
    expect(screen.getByText(COPY.holdersTopCaption)).toBeInTheDocument();
    expect(screen.getByText('% Supply')).toBeInTheDocument();
    expect(screen.getAllByText('25,400,000 MHOOD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.54%').length).toBeGreaterThan(0);
    expect(screen.getByTestId('holder-ranking-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('holder-ranking-mobile')).toHaveTextContent('#1');
    expect(screen.getByTestId('holder-ranking-mobile')).toHaveTextContent('1111...1111');
    expect(screen.queryByText('11111111111111111111111111111111')).not.toBeInTheDocument();
    expect(screen.queryByText(/Development data/)).not.toBeInTheDocument();
  });

  it('shows only the Top 20 from a 48-holder community list', () => {
    render(
      <HolderRanking
        snapshot={{ ...snapshot, entries: communityHolders(48) }}
        loading={false}
        error={null}
        currentWallet={null}
        onRetry={() => undefined}
      />,
    );
    expect(document.querySelectorAll('.forest-table tbody tr')).toHaveLength(20);
    expect(screen.getByTestId('holder-ranking-mobile').querySelectorAll('.ranking-card')).toHaveLength(20);
    expect(screen.getAllByText('#20').length).toBeGreaterThan(0);
    expect(screen.queryByText('#21')).not.toBeInTheDocument();
    expect(screen.queryByText('#48')).not.toBeInTheDocument();
    expect(screen.queryByTestId('your-position')).not.toBeInTheDocument();
  });

  it('shows a separate Your Position card when the connected wallet is rank 27', () => {
    render(
      <HolderRanking
        snapshot={{ ...snapshot, entries: communityHolders(48, 27) }}
        loading={false}
        error={null}
        currentWallet={YOU}
        onRetry={() => undefined}
      />,
    );
    const position = screen.getByTestId('your-position');
    expect(position).toHaveTextContent('Your position');
    expect(position).toHaveTextContent('#27');
    expect(position).toHaveTextContent('YouW...1111');
    expect(position).toHaveTextContent('9973 MHOOD');
    expect(position).toHaveTextContent('0.01%');
    expect(screen.queryByText('#21')).not.toBeInTheDocument();
    expect(screen.getByTestId('holder-ranking-mobile').querySelector('.is-you')).toBeNull();
    expect(document.querySelector('.forest-table tr.is-you')).toBeNull();
  });

  it('highlights rank 8 in the Top 20 and does not duplicate Your Position', () => {
    render(
      <HolderRanking
        snapshot={{ ...snapshot, entries: communityHolders(48, 8) }}
        loading={false}
        error={null}
        currentWallet={YOU}
        onRetry={() => undefined}
      />,
    );
    expect(screen.queryByTestId('your-position')).not.toBeInTheDocument();
    expect(document.querySelector('.forest-table tr.is-you')).not.toBeNull();
    expect(screen.getByTestId('holder-ranking-mobile').querySelector('.is-you')).toHaveTextContent('#8');
    expect(screen.getByTestId('holder-ranking-mobile').querySelectorAll('.ranking-card')).toHaveLength(20);
  });

  it('shows a themed loading state and a ranking error with retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <HolderRanking snapshot={null} loading error={null} currentWallet={null} onRetry={onRetry} />,
    );
    expect(screen.getByText(COPY.ledgerReading)).toBeInTheDocument();

    rerender(
      <HolderRanking
        snapshot={null}
        loading={false}
        error={COPY.ledgerError}
        currentWallet={null}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(COPY.ledgerError)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/MOCK_FOREST_HOLDER/)).not.toBeInTheDocument();
  });
});
