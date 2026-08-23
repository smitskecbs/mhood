import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        adapter: { name: 'Phantom', url: 'https://phantom.app', connect: vi.fn() },
        readyState: 'Installed',
      },
    ],
  }),
}));

vi.mock('../../utils/mobileWallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/mobileWallet')>('../../utils/mobileWallet');
  return {
    ...actual,
    detectMobileWalletContext: () => ({ mobile: true, inWalletBrowser: true }),
  };
});

describe('WalletGate inside a wallet browser', () => {
  it('uses the normal connect flow and does not open a browse deep link', async () => {
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
    expect(screen.queryByRole('link', { name: /open in phantom/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get phantom/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /phantom/i }));
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith('Phantom');
    });
    expect(connect).toHaveBeenCalled();
  });
});
