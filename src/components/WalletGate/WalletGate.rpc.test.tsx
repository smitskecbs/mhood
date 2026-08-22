import { render, screen } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';

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

describe('WalletGate RPC failure', () => {
  it('keeps the wallet connected and only retries the holder check', () => {
    const onRetry = vi.fn();
    render(
      <WalletGate
        visible
        status="error"
        mint={null}
        balance={null}
        error="The forest cannot verify your MHOOD right now."
        errorDetail="RPC connection unavailable."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('The forest cannot verify your MHOOD right now.')).toBeInTheDocument();
    expect(screen.getByText('RPC connection unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open the gate/i })).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
