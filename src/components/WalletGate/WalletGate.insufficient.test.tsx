import { render, screen } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';
import type { MintDetails, WalletMhoodBalance } from '../../types';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: true,
    disconnect: vi.fn(),
    publicKey: new PublicKey(1),
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

const balance: WalletMhoodBalance = {
  wallet: new PublicKey(1).toBase58(),
  mint: mint.mint,
  decimals: 6,
  tokenProgramKind: 'spl-token',
  totalRaw: 742_381_000_000n,
  accounts: [],
  meetsAccessThreshold: false,
  fetchedAt: 0,
};

describe('WalletGate insufficient balance', () => {
  it('does not keep the insufficient holder on the Gate II error card', () => {
    render(
      <WalletGate
        visible
        leaving
        status="insufficient"
        mint={mint}
        balance={balance}
        error={null}
        onRetry={() => undefined}
      />,
    );
    expect(screen.queryByText('THE FOREST REMAINS CLOSED')).not.toBeInTheDocument();
    expect(screen.queryByText('THE FOREST KNOWS WHAT YOU CARRY.')).not.toBeInTheDocument();
    expect(screen.queryByText('742,381 / 1,000,000 MHOOD')).not.toBeInTheDocument();
    expect(screen.queryByText('ACCESS GRANTED')).not.toBeInTheDocument();
    expect(document.querySelector('.gate-shell')).toHaveClass('is-leaving');
  });
});
