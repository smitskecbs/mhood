import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WalletGate } from './WalletGate';

const { select, connect, adapterConnect, emit } = vi.hoisted(() => ({
  select: vi.fn(),
  connect: vi.fn(async () => undefined),
  adapterConnect: vi.fn(async () => undefined),
  emit: vi.fn(),
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
        adapter: {
          name: 'Backpack',
          url: 'https://backpack.app',
          connect: adapterConnect,
          connected: false,
          emit,
        },
        readyState: 'Installed',
      },
      {
        adapter: { name: 'Phantom', url: 'https://phantom.app', connect: vi.fn() },
        readyState: 'Installed',
      },
      {
        adapter: { name: 'Solflare', url: 'https://solflare.com', connect: vi.fn() },
        readyState: 'Loadable',
      },
    ],
  }),
}));

describe('WalletGate explicit connect', () => {
  beforeEach(() => {
    select.mockClear();
    connect.mockClear();
    adapterConnect.mockClear();
    emit.mockClear();
  });

  it('selects and connects Backpack via wallet context, then waits for Sign to enter', async () => {
    render(
      <WalletGate
        visible
        status="disconnected"
        mint={null}
        balance={null}
        error={null}
        onRetry={() => undefined}
        onSign={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open the gate/i }));
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /backpack/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /backpack/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign to enter' })).toBeInTheDocument();
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('Backpack');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(adapterConnect).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /open the gate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /backpack/i })).not.toBeInTheDocument();
  });
});
