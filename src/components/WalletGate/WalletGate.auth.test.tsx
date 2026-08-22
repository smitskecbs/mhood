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

describe('WalletGate signature step', () => {
  it('asks to sign after connect and does not start Forest access yet', () => {
    const onSign = vi.fn();
    render(
      <WalletGate
        visible
        status="awaiting_signature"
        mint={null}
        balance={null}
        error={null}
        onRetry={() => undefined}
        onSign={onSign}
      />,
    );
    expect(screen.getByText('PROVE YOUR CLAIM')).toBeInTheDocument();
    expect(screen.getByText('Sign a message to prove this wallet belongs to you.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign to enter' })).toBeEnabled();
    screen.getByRole('button', { name: 'Sign to enter' }).click();
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ACCESS GRANTED')).not.toBeInTheDocument();
    expect(screen.queryByText('The forest is listening…')).not.toBeInTheDocument();
  });

  it('keeps the wallet connected after a rejected signature', () => {
    render(
      <WalletGate
        visible
        status="awaiting_signature"
        mint={null}
        balance={null}
        error={null}
        authIssue="rejected"
        onRetry={() => undefined}
        onSign={() => undefined}
      />,
    );
    expect(screen.getByText('The forest remains closed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /open the gate/i })).not.toBeInTheDocument();
  });

  it('denies wallets that cannot sign the access message', () => {
    render(
      <WalletGate
        visible
        status="awaiting_signature"
        mint={null}
        balance={null}
        error={null}
        authIssue="unsupported"
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('This wallet cannot sign the Forest access message.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign to enter' })).not.toBeInTheDocument();
  });
});
