import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { type Adapter, type WalletError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  getConnectionEndpoint,
  safeHttpRpcEndpoint,
  UNCONFIGURED_RPC_PLACEHOLDER,
} from '../services/solana/connection';
import { createSupportedWalletAdapters, formatWalletConnectError } from '../config/wallets';
import { AUTO_CONNECT_ON_LOAD, WALLET_STORAGE_KEY, forgetPersistedWalletSelection } from '../config/walletConnect';
import { WalletConnectObserver } from './WalletConnectObserver';
import { WalletUiContext } from './walletUiContext';
import { devLog } from '../utils/devLog';
import '@solana/wallet-adapter-react-ui/styles.css';

forgetPersistedWalletSelection();

type SolanaProvidersProps = {
  children: ReactNode;
};

export function SolanaProviders({ children }: SolanaProvidersProps) {
  const wallets = useMemo(() => createSupportedWalletAdapters(), []);
  const endpoint = useMemo(() => {
    try {
      return safeHttpRpcEndpoint(getConnectionEndpoint());
    } catch {
      return UNCONFIGURED_RPC_PLACEHOLDER;
    }
  }, []);
  const connectionConfig = useMemo(() => ({ commitment: 'confirmed' as const }), []);
  const [connectError, setConnectError] = useState<string | null>(null);

  const onError = useCallback((error: WalletError, adapter?: Adapter) => {
    const walletName = adapter?.name ?? 'Wallet';
    const message = formatWalletConnectError(error, walletName);

    if (error.name === 'WalletNotReadyError') {
      devLog(`${walletName} connect error: ${message}`);
      setConnectError(message);
      return;
    }

    if (/reject|cancel|decline/i.test(error.message)) {
      devLog(`${walletName} connect cancelled`);
      setConnectError(null);
      return;
    }

    devLog(`${walletName} connect error: ${error.message || error.name}`);
    setConnectError(message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider
        wallets={wallets}
        autoConnect={AUTO_CONNECT_ON_LOAD}
        localStorageKey={WALLET_STORAGE_KEY}
        onError={onError}
      >
        <WalletModalProvider>
          <WalletUiContext.Provider value={{ connectError, clearConnectError: () => setConnectError(null) }}>
            <WalletConnectObserver />
            {children}
          </WalletUiContext.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
