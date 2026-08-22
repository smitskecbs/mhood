import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';

const { select, connect, navigateToWalletBrowse } = vi.hoisted(() => ({
  select: vi.fn(),
  connect: vi.fn(async () => undefined),
  navigateToWalletBrowse: vi.fn(),
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
        readyState: 'NotDetected',
      },
      {
        adapter: { name: 'Phantom', url: 'https://phantom.app', connect: vi.fn() },
        readyState: 'NotDetected',
      },
      {
        adapter: { name: 'Solflare', url: 'https://solflare.com', connect: vi.fn() },
        readyState: 'NotDetected',
      },
    ],
  }),
}));

vi.mock('../../utils/mobileWallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/mobileWallet')>('../../utils/mobileWallet');
  return {
    ...actual,
    detectMobileWalletContext: () => ({ mobile: true, inWalletBrowser: false }),
    navigateToWalletBrowse,
  };
});

describe('WalletGate mobile browse links', () => {
  it('opens official wallet browse links instead of the download page', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://mhood.cbs-coin.com/',
        origin: 'https://mhood.cbs-coin.com',
        assign: vi.fn(),
      },
    });

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
    expect(screen.getByRole('button', { name: 'Open in Backpack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Phantom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Solflare' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get Backpack' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open in Phantom' }));
    expect(navigateToWalletBrowse).toHaveBeenCalledTimes(1);
    expect(navigateToWalletBrowse.mock.calls[0]?.[0]).toContain('https://phantom.app/ul/browse/');
    expect(navigateToWalletBrowse.mock.calls[0]?.[0]).toContain(encodeURIComponent('https://mhood.cbs-coin.com/'));
    expect(navigateToWalletBrowse.mock.calls[0]?.[0]).not.toContain('phantom.app/download');
    expect(select).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Get Phantom' })).toBeInTheDocument();
  });
});
