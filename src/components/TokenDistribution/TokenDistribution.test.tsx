import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TokenDistribution } from './TokenDistribution';
import { presentHolderRanking } from '../../utils/holderPresentation';
import { PROJECT_WALLETS } from '../../config/projectWallets';
import type { HolderRankingSnapshot, MintDetails } from '../../types';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1_000_000_000_000_000n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

const snapshot: HolderRankingSnapshot = {
  live: true,
  source: 'rpc',
  disclaimer: 'test',
  fetchedAt: 0,
  entries: [
    {
      rank: 1,
      wallet: PROJECT_WALLETS.treasury.address,
      balanceRaw: '1000000000',
      balanceUi: '1,000',
      supplyPercent: '0.10%',
    },
  ],
};

describe('TokenDistribution', () => {
  it('renders live project allocation labels', () => {
    const presentation = presentHolderRanking(snapshot, mint.decimals, mint.supplyRaw);
    render(<TokenDistribution mint={mint} presentation={presentation} />);
    expect(screen.getByText('TOKEN DISTRIBUTION')).toBeInTheDocument();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('15% Token Lock')).toBeInTheDocument();
    expect(screen.getByText('Dev Wallet')).toBeInTheDocument();
    expect(screen.getByText('Presale Site')).toBeInTheDocument();
    expect(screen.getByText('Community-held MHOOD')).toBeInTheDocument();
  });
});
