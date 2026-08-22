import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseRealBurnFlag } from '../../config/env';
import { StatsCards } from './StatsCards';
import type { BurnRankingSnapshot, MintDetails } from '../../types';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

const snapshot: BurnRankingSnapshot = {
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

describe('burn UI defaults', () => {
  it('does not enable real burns unless the env flag is the string true', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(parseRealBurnFlag('true')).toBe(true);
  });

  it('renders grove statistics without fake burn records', () => {
    render(<StatsCards mint={mint} snapshot={snapshot} wallet={null} />);
    expect(screen.getByText('Total MHOOD Burned')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Dev data')).not.toBeInTheDocument();
  });
});
