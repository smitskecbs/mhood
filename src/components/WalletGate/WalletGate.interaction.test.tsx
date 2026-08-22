import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';

const { select, connect } = vi.hoisted(() => ({
  select: vi.fn(),
  connect: vi.fn(async () => undefined),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    disconnect: vi.fn(),
    publicKey: null,
    select,
    connect,
    wallet: null,
    wallets: [
      {
        adapter: { name: 'Backpack', url: 'https://backpack.app', connect: vi.fn(), connected: false },
        readyState: 'Installed',
      },
      {
        adapter: { name: 'Phantom', url: 'https://phantom.app', connect: vi.fn() },
        readyState: 'Installed',
      },
    ],
  }),
}));

describe('WalletGate interaction timing', () => {
  it('is interactive as soon as the wallet UI is visible', () => {
    render(
      <WalletGate
        visible
        status="disconnected"
        mint={null}
        balance={null}
        error={null}
        onRetry={() => undefined}
      />,
    );
    const shell = document.querySelector('.gate-shell');
    expect(shell).toHaveAttribute('data-wallet-interactive', 'true');
    expect(shell).toHaveAttribute('data-wallet-visible', 'true');
    expect(shell).toHaveClass('is-interactive');
    expect(screen.getByRole('button', { name: /open the gate/i })).toBeEnabled();
  });

  it('opens the wallet picker immediately on Open the gate', () => {
    render(
      <WalletGate
        visible
        status="disconnected"
        mint={null}
        balance={null}
        error={null}
        onRetry={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open the gate/i }));
    expect(screen.getByRole('button', { name: /backpack/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /phantom/i })).toBeInTheDocument();
  });
});
