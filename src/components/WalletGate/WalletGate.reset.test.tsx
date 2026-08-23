import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';

const { select, connect, disconnect } = vi.hoisted(() => ({
  select: vi.fn(),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    disconnect,
    publicKey: null,
    select,
    connect,
    wallet: null,
    wallets: [
      {
        adapter: { name: 'Backpack', url: 'https://backpack.app', connect: vi.fn(), connected: false },
        readyState: 'NotDetected',
      },
      {
        adapter: { name: 'Phantom', url: 'https://phantom.app', connect: vi.fn() },
        readyState: 'NotDetected',
      },
      {
        adapter: { name: 'Solflare', url: 'https://solflare.com', connect: vi.fn() },
        readyState: 'Loadable',
      },
    ],
  }),
}));

describe('WalletGate try another wallet', () => {
  it('opens the wallet picker when preferPicker is set after a reset', () => {
    render(
      <WalletGate
        visible
        preferPicker
        status="disconnected"
        mint={null}
        balance={null}
        error={null}
        onRetry={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: /open the gate/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /backpack/i })).toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});
