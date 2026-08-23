import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HolderRanking } from './HolderRanking';
import { COPY } from '../../config/constants';
import type { HolderRankingSnapshot } from '../../types';

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
      wallet: 'YouWallet11111111111111111111111111',
      balanceRaw: '1250000000000',
      balanceUi: '1,250,000',
      supplyPercent: '0.12%',
    },
  ],
};

describe('HolderRanking', () => {
  it('renders live ranking columns without mock data', () => {
    render(
      <HolderRanking
        snapshot={snapshot}
        loading={false}
        error={null}
        currentWallet="YouWallet11111111111111111111111111"
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('FOREST HOLDERS')).toBeInTheDocument();
    expect(screen.getByText('% Supply')).toBeInTheDocument();
    expect(screen.getAllByText('25,400,000 MHOOD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.54%').length).toBeGreaterThan(0);
    expect(screen.getByTestId('holder-ranking-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('holder-ranking-mobile')).toHaveTextContent('#1');
    expect(screen.getByTestId('holder-ranking-mobile')).toHaveTextContent('1111...1111');
    expect(screen.queryByText('11111111111111111111111111111111')).not.toBeInTheDocument();
    expect(screen.queryByText(/Development data/)).not.toBeInTheDocument();
  });

  it('shows the connected wallet outside the visible top list', () => {
    const entries = Array.from({ length: 101 }, (_, index) => ({
      rank: index + 1,
      wallet: index === 100 ? 'YouWallet11111111111111111111111111' : `Holder${index.toString().padStart(3, '0')}111111111111111111111111`,
      balanceRaw: String(101 - index),
      balanceUi: String(101 - index),
      supplyPercent: '<0.01%',
    }));
    render(
      <HolderRanking
        snapshot={{ ...snapshot, entries }}
        loading={false}
        error={null}
        currentWallet="YouWallet11111111111111111111111111"
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('Your position')).toBeInTheDocument();
    expect(screen.getByText(/#101/)).toBeInTheDocument();
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
