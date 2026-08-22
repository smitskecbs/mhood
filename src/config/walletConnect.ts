export const WALLET_STORAGE_KEY = 'moginhoodWallet';

/** Page load must never reconnect a previously chosen wallet. */
export const AUTO_CONNECT_ON_LOAD = false;

export function forgetPersistedWalletSelection(
  storage: Pick<Storage, 'removeItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
  key = WALLET_STORAGE_KEY,
): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Private mode / blocked storage should not break the gate.
  }
}

export function shouldConnectOnPageLoad(): boolean {
  return AUTO_CONNECT_ON_LOAD;
}

/**
 * After the modal selects a wallet, connect() must be called explicitly.
 * This replaces WalletProvider autoConnect without bringing back silent reconnect.
 */
export function shouldExplicitlyConnect(state: {
  walletName: string | null;
  connected: boolean;
  connecting: boolean;
  attemptedWallet: string | null;
}): boolean {
  if (!state.walletName) return false;
  if (state.connected || state.connecting) return false;
  if (state.attemptedWallet === state.walletName) return false;
  return true;
}
