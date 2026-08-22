import { WalletAdapterNetwork, WalletReadyState, type Adapter } from '@solana/wallet-adapter-base';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

export const SUPPORTED_WALLET_NAMES = ['Backpack', 'Phantom', 'Solflare'] as const;

export type WalletClickAction = 'connect' | 'open-in-wallet' | 'install' | 'noop';

export function isWalletReadyForPopup(readyState: WalletReadyState): boolean {
  return readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable;
}

export function resolveWalletClickAction(input: {
  readyState: WalletReadyState;
  alreadyConnected: boolean;
  mobile?: boolean;
  inWalletBrowser?: boolean;
}): WalletClickAction {
  if (input.alreadyConnected) return 'noop';
  if (input.inWalletBrowser || isWalletReadyForPopup(input.readyState)) return 'connect';
  if (input.mobile) return 'open-in-wallet';
  return 'install';
}

/**
 * Wallet Standard may register the same wallet beside a legacy adapter.
 * Prefer the installed/loadable instance so connect() can open the extension popup.
 */
export function preferReadyWallets<T extends { adapter: { name: string }; readyState: WalletReadyState }>(
  wallets: T[],
  names: readonly string[] = SUPPORTED_WALLET_NAMES,
): T[] {
  const byName = new Map<string, T>();
  for (const wallet of wallets) {
    if (!names.includes(wallet.adapter.name as (typeof SUPPORTED_WALLET_NAMES)[number])) continue;
    const existing = byName.get(wallet.adapter.name);
    if (!existing) {
      byName.set(wallet.adapter.name, wallet);
      continue;
    }
    if (isWalletReadyForPopup(wallet.readyState) && !isWalletReadyForPopup(existing.readyState)) {
      byName.set(wallet.adapter.name, wallet);
    }
  }
  return names.map((name) => byName.get(name)).filter((wallet): wallet is T => Boolean(wallet));
}

export function uniqueAdaptersByName(adapters: Adapter[]): Adapter[] {
  const seen = new Set<string>();
  return adapters.filter((adapter) => {
    if (seen.has(adapter.name)) return false;
    seen.add(adapter.name);
    return true;
  });
}

export function createSupportedWalletAdapters(): Adapter[] {
  return uniqueAdaptersByName([
    new BackpackWalletAdapter(),
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
  ]);
}

export function isGateDebugEnabled(
  dev = import.meta.env.DEV,
  flag = import.meta.env.VITE_SHOW_GATE_DEBUG,
): boolean {
  return dev === true && flag === 'true';
}

export function formatWalletConnectError(error: { name?: string; message?: string }, walletName?: string): string {
  const name = walletName ?? '';
  if (error.name === 'WalletNotReadyError' || /not detected|not found|not installed/i.test(error.message ?? '')) {
    if (name === 'Backpack') return 'Backpack wallet was not detected.';
    return `${name || 'Wallet'} was not detected.`;
  }
  return error.message || `${name || 'Wallet'} failed to connect.`;
}

export function walletPickerLabel(input: {
  name: string;
  action: WalletClickAction;
}): string {
  if (input.action === 'open-in-wallet') return `Open in ${input.name}`;
  return input.name;
}
