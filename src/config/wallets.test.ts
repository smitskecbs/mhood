import { describe, expect, it } from 'vitest';
import { AUTO_CONNECT_ON_LOAD } from './walletConnect';
import {
  createSupportedWalletAdapters,
  formatWalletConnectError,
  isGateDebugEnabled,
  preferReadyWallets,
  resolveWalletClickAction,
  uniqueAdaptersByName,
  walletPickerLabel,
} from './wallets';
import { WalletReadyState } from '@solana/wallet-adapter-base';

describe('wallet adapters', () => {
  it('includes Backpack, Phantom and Solflare', () => {
    const names = createSupportedWalletAdapters().map((adapter) => adapter.name);
    expect(names).toEqual(expect.arrayContaining(['Backpack', 'Phantom', 'Solflare']));
    expect(names.filter((name) => name === 'Backpack')).toHaveLength(1);
    expect(AUTO_CONNECT_ON_LOAD).toBe(false);
  });

  it('deduplicates adapters with the same name', () => {
    const adapters = createSupportedWalletAdapters();
    const doubled = uniqueAdaptersByName([...adapters, ...adapters]);
    const backpack = doubled.filter((adapter) => adapter.name === 'Backpack');
    expect(backpack).toHaveLength(1);
    expect(doubled.map((adapter) => adapter.name)).toEqual(adapters.map((adapter) => adapter.name));
  });
});

describe('wallet click connect', () => {
  it('connects from a user click when the adapter is ready', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.Installed,
        alreadyConnected: false,
      }),
    ).toBe('connect');
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.Loadable,
        alreadyConnected: false,
      }),
    ).toBe('connect');
  });

  it('does not auto-connect an unready or already-connected wallet', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.NotDetected,
        alreadyConnected: false,
      }),
    ).toBe('install');
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.Installed,
        alreadyConnected: true,
      }),
    ).toBe('noop');
  });

  it('keeps the desktop adapter flow on desktop even when the wallet is missing', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.NotDetected,
        alreadyConnected: false,
        mobile: false,
        inWalletBrowser: false,
      }),
    ).toBe('install');
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.Installed,
        alreadyConnected: false,
        mobile: false,
      }),
    ).toBe('connect');
  });

  it('offers a browse deep link on mobile outside a wallet browser', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.NotDetected,
        alreadyConnected: false,
        mobile: true,
        inWalletBrowser: false,
      }),
    ).toBe('open-in-wallet');
  });

  it('offers a browse deep link on mobile even when the adapter is Loadable', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.Loadable,
        alreadyConnected: false,
        mobile: true,
        inWalletBrowser: false,
      }),
    ).toBe('open-in-wallet');
  });

  it('connects normally once the dapp is already inside a wallet browser', () => {
    expect(
      resolveWalletClickAction({
        readyState: WalletReadyState.NotDetected,
        alreadyConnected: false,
        mobile: true,
        inWalletBrowser: true,
      }),
    ).toBe('connect');
  });

  it('prefers the installed Standard Wallet over a legacy duplicate', () => {
    const listed = preferReadyWallets([
      { adapter: { name: 'Backpack' }, readyState: WalletReadyState.NotDetected },
      { adapter: { name: 'Backpack' }, readyState: WalletReadyState.Installed },
      { adapter: { name: 'Phantom' }, readyState: WalletReadyState.Installed },
    ]);
    expect(listed.map((wallet) => `${wallet.adapter.name}:${wallet.readyState}`)).toEqual([
      'Backpack:Installed',
      'Phantom:Installed',
    ]);
  });
});

describe('wallet connect errors', () => {
  it('shows a visible Backpack-not-detected message', () => {
    expect(formatWalletConnectError({ name: 'WalletNotReadyError', message: 'not ready' }, 'Backpack')).toBe(
      'Backpack wallet was not detected.',
    );
  });
});

describe('gate debug overlay', () => {
  it('is hidden by default even in development', () => {
    expect(isGateDebugEnabled(true, undefined)).toBe(false);
    expect(isGateDebugEnabled(true, 'false')).toBe(false);
    expect(isGateDebugEnabled(false, 'true')).toBe(false);
  });

  it('is visible only with development plus the env flag', () => {
    expect(isGateDebugEnabled(true, 'true')).toBe(true);
  });
});

describe('wallet picker labels', () => {
  it('uses Open in … only for the mobile browse action', () => {
    expect(walletPickerLabel({ name: 'Backpack', action: 'connect' })).toBe('Backpack');
    expect(walletPickerLabel({ name: 'Phantom', action: 'open-in-wallet' })).toBe('Open in Phantom');
    expect(walletPickerLabel({ name: 'Solflare', action: 'install' })).toBe('Solflare');
  });
});
