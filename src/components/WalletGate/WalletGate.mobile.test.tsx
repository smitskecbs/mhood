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

vi.mock('../../utils/mobileWallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/mobileWallet')>('../../utils/mobileWallet');
  return {
    ...actual,
    detectMobileWalletContext: () => ({ mobile: true, inWalletBrowser: false }),
  };
});

describe('WalletGate mobile browse links', () => {
  it('uses official browse hrefs so a user click opens the dapp in the wallet browser', () => {
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

    const encoded = encodeURIComponent('https://mhood.cbs-coin.com');
    const backpack = screen.getByRole('link', { name: 'Open in Backpack' });
    const phantom = screen.getByRole('link', { name: 'Open in Phantom' });
    const solflare = screen.getByRole('link', { name: 'Open in Solflare' });

    expect(phantom).toHaveAttribute('href', `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`);
    expect(backpack).toHaveAttribute('href', `https://backpack.app/ul/v1/browse/${encoded}?ref=${encoded}`);
    expect(solflare).toHaveAttribute('href', `https://solflare.com/ul/v1/browse/${encoded}?ref=${encoded}`);
    expect(backpack.getAttribute('href')).toContain(encoded);
    expect(phantom.getAttribute('href')).not.toContain('phantom.app/download');
    expect(solflare.getAttribute('href')).not.toContain('solflare.com/download');
    expect(select).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Get Backpack' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Phantom' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Solflare' })).toBeInTheDocument();
  });
});
