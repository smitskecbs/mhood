import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletGate } from './WalletGate';
import { WalletUiContext } from '../../app/walletUiContext';

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

describe('WalletGate Backpack connect error', () => {
  it('shows a visible message when Backpack is not detected', () => {
    render(
      <WalletUiContext.Provider
        value={{ connectError: 'Backpack wallet was not detected.', clearConnectError: () => undefined }}
      >
        <WalletGate
          visible
          status="disconnected"
          mint={null}
          balance={null}
          error={null}
          onRetry={() => undefined}
        />
      </WalletUiContext.Provider>,
    );
    expect(screen.getByText('Backpack wallet was not detected.')).toBeInTheDocument();
  });
});
