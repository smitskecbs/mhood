import { describe, expect, it } from 'vitest';
import {
  AUTO_CONNECT_ON_LOAD,
  forgetPersistedWalletSelection,
  shouldConnectOnPageLoad,
  shouldExplicitlyConnect,
  WALLET_STORAGE_KEY,
} from './walletConnect';

describe('manual wallet connect', () => {
  it('does not auto-connect on page load', () => {
    expect(AUTO_CONNECT_ON_LOAD).toBe(false);
    expect(shouldConnectOnPageLoad()).toBe(false);
  });

  it('connects only after an explicit wallet selection', () => {
    expect(
      shouldExplicitlyConnect({
        walletName: 'Backpack',
        connected: false,
        connecting: false,
        attemptedWallet: null,
      }),
    ).toBe(true);
    expect(
      shouldExplicitlyConnect({
        walletName: 'Phantom',
        connected: false,
        connecting: false,
        attemptedWallet: null,
      }),
    ).toBe(true);
    expect(
      shouldExplicitlyConnect({
        walletName: 'Solflare',
        connected: false,
        connecting: false,
        attemptedWallet: null,
      }),
    ).toBe(true);
  });

  it('does not reconnect a wallet that is already connected or in-flight', () => {
    expect(
      shouldExplicitlyConnect({
        walletName: 'Backpack',
        connected: true,
        connecting: false,
        attemptedWallet: null,
      }),
    ).toBe(false);
    expect(
      shouldExplicitlyConnect({
        walletName: 'Backpack',
        connected: false,
        connecting: true,
        attemptedWallet: null,
      }),
    ).toBe(false);
    expect(
      shouldExplicitlyConnect({
        walletName: 'Backpack',
        connected: false,
        connecting: false,
        attemptedWallet: 'Backpack',
      }),
    ).toBe(false);
    expect(
      shouldExplicitlyConnect({
        walletName: null,
        connected: false,
        connecting: false,
        attemptedWallet: null,
      }),
    ).toBe(false);
  });

  it('clears the persisted wallet name without connecting', () => {
    const storage = {
      removed: '' as string,
      removeItem(key: string) {
        this.removed = key;
      },
    };
    forgetPersistedWalletSelection(storage);
    expect(storage.removed).toBe(WALLET_STORAGE_KEY);
  });
});
