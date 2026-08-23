import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BurnRanking } from './BurnRanking';
import { COPY } from '../../config/constants';
import type { BurnRankingSnapshot } from '../../types';

const empty: BurnRankingSnapshot = {
  entries: [],
  records: [],
  totalBurnedRaw: '0',
  totalBurns: 0,
  uniqueBurners: 0,
  source: 'none',
  live: false,
  disclaimer: 'Verified forest burns will appear here once burn indexing is enabled.',
  fetchedAt: 0,
};

describe('BurnRanking', () => {
  it('shows an empty state instead of fake burn records', () => {
    render(<BurnRanking snapshot={empty} loading={false} error={null} currentWallet={null} />);
    expect(screen.getByText(COPY.noBurns)).toBeInTheDocument();
    expect(screen.queryByText(/MOCK_FOREST_BURNER/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Development data/)).not.toBeInTheDocument();
  });

  it('renders compact mobile ranking rows beside the desktop table', () => {
    render(
      <BurnRanking
        snapshot={{
          ...empty,
          persistence: 'persistent',
          live: true,
          entries: [
            {
              rank: 1,
              wallet: 'BurnerWallet1111111111111111111111111',
              totalBurnedRaw: '2000000',
              totalBurnedUi: '2',
              burns: 2,
              lastBurn: 1_700_000_000,
            },
          ],
        }}
        loading={false}
        error={null}
        currentWallet={null}
      />,
    );
    expect(screen.getByTestId('burn-ranking-mobile')).toHaveTextContent('#1');
    expect(screen.getByTestId('burn-ranking-mobile')).toHaveTextContent('Burn...1111');
    expect(screen.getByTestId('burn-ranking-mobile')).toHaveTextContent('2 MHOOD · 2 burns');
    expect(screen.getByTestId('burn-ranking-mobile')).toHaveTextContent('Last burn:');
    expect(screen.queryByText('BurnerWallet1111111111111111111111111')).not.toBeInTheDocument();
  });

  it('says production burn history is not stored yet when persistence is inactive', () => {
    render(
      <BurnRanking
        snapshot={{ ...empty, persistence: 'inactive', disclaimer: COPY.legendsPersistenceInactive }}
        loading={false}
        error={null}
        currentWallet={null}
      />,
    );
    expect(screen.getByText(COPY.legendsPersistenceInactive)).toBeInTheDocument();
    expect(screen.queryByText(COPY.noBurns)).not.toBeInTheDocument();
  });
});
