import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseRealBurnFlag } from '../../config/env';
import { StatsCards } from './StatsCards';
import type { BurnRankingSnapshot, MintDetails } from '../../types';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 999_999_998_000_000n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

const inactiveSnapshot: BurnRankingSnapshot = {
  entries: [
    {
      rank: 1,
      wallet: 'FAKE_LEADERBOARD_WALLET',
      totalBurnedRaw: '999999999999',
      totalBurnedUi: '999,999.999999',
      burns: 99,
      lastBurn: 1,
      label: 'Fake',
    },
  ],
  records: [],
  totalBurnedRaw: '999999999999',
  totalBurns: 99,
  uniqueBurners: 12,
  source: 'none',
  live: false,
  persistence: 'inactive',
  disclaimer: 'Verified forest burns will appear here once burn indexing is enabled.',
  fetchedAt: 0,
};

describe('burn UI defaults', () => {
  it('does not enable real burns unless the env flag is the string true', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(parseRealBurnFlag('true')).toBe(true);
  });

  it('shows on-chain current supply and total burned without fake leaderboard stats', () => {
    render(<StatsCards mint={mint} snapshot={inactiveSnapshot} wallet={null} />);
    expect(screen.getByText('Current Supply')).toBeInTheDocument();
    expect(screen.getByText('999,999,998 MHOOD')).toBeInTheDocument();
    expect(screen.getByText('Total MHOOD Burned')).toBeInTheDocument();
    expect(screen.getByText('2 MHOOD')).toBeInTheDocument();
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Dev data')).not.toBeInTheDocument();
    expect(screen.queryByText('FAKE_LEADERBOARD_WALLET')).not.toBeInTheDocument();
  });

  it('does not use the leaderboard total as global burned supply', () => {
    render(<StatsCards mint={mint} snapshot={inactiveSnapshot} wallet={null} />);
    expect(screen.queryByText('999,999.999999')).not.toBeInTheDocument();
  });
});
