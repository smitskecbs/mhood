import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessDebugPanel } from './AccessDebugPanel';
import type { MintDetails } from '../../types';

vi.mock('../../config/wallets', async () => {
  const actual = await vi.importActual<typeof import('../../config/wallets')>('../../config/wallets');
  return {
    ...actual,
    isGateDebugEnabled: () => true,
  };
});

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

describe('AccessDebugPanel with flag', () => {
  it('renders only when development debug is explicitly enabled', () => {
    render(
      <AccessDebugPanel
        wallet="DemoWallet"
        status="checking"
        mint={mint}
        balance={null}
        error={null}
        checking
      />,
    );
    expect(screen.getByText(/DEV gate/i)).toBeInTheDocument();
    expect(screen.getByText('DemoWallet')).toBeInTheDocument();
  });
});
