import { createContext, useContext } from 'react';

export type WalletUiState = {
  connectError: string | null;
  clearConnectError: () => void;
};

export const WalletUiContext = createContext<WalletUiState>({
  connectError: null,
  clearConnectError: () => undefined,
});

export function useWalletUi() {
  return useContext(WalletUiContext);
}
