import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';
import type { MintDetails, WalletMhoodBalance } from '../../types';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    disconnect: vi.fn(),
    publicKey: null,
    select: vi.fn(),
    wallets: [],
  }),
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));

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

describe('WalletGate disconnected', () => {
  it('renders the gate copy and connect action when no wallet is connected', () => {
    render(
      <WalletGate
        visible
        status="disconnected"
        mint={mint}
        balance={null}
        error={null}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('THE FOREST DOES NOT OPEN FOR EVERYONE.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open the gate/i })).toBeInTheDocument();
  });
});

describe('ranking placeholders', () => {
  it('keeps a typed balance object ready for later live ranks', () => {
    const balance: WalletMhoodBalance = {
      wallet: 'DemoWallet',
      mint: mint.mint,
      decimals: 6,
      tokenProgramKind: 'spl-token',
      totalRaw: 742_381_000_000n,
      accounts: [],
      meetsAccessThreshold: false,
      fetchedAt: 0,
    };
    expect(balance.meetsAccessThreshold).toBe(false);
  });
});
