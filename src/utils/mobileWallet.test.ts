import { describe, expect, it } from 'vitest';
import {
  buildWalletBrowseUrl,
  detectMobileWalletContext,
  isInSolanaWalletBrowser,
  isMobileUserAgent,
  WALLET_INSTALL_URLS,
} from './mobileWallet';

const DAPP = 'https://mhood.cbs-coin.com/';
const ORIGIN = 'https://mhood.cbs-coin.com';

describe('mobile wallet detection', () => {
  it('treats phones as mobile and desktops as not', () => {
    expect(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(false);
  });

  it('detects an in-app wallet browser from provider or UA', () => {
    expect(isInSolanaWalletBrowser({ phantom: true })).toBe(true);
    expect(isInSolanaWalletBrowser({ backpack: true })).toBe(true);
    expect(isInSolanaWalletBrowser({ solflare: true })).toBe(true);
    expect(isInSolanaWalletBrowser({ ua: 'Mozilla/5.0 Phantom/25.0' })).toBe(true);
    expect(isInSolanaWalletBrowser({ ua: 'Mozilla/5.0 (iPhone)' })).toBe(false);
  });

  it('does not treat a normal mobile Safari session as already inside a wallet', () => {
    const context = detectMobileWalletContext({
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      win: {},
    });
    expect(context.mobile).toBe(true);
    expect(context.inWalletBrowser).toBe(false);
  });
});

describe('official wallet browse links', () => {
  it('builds Phantom, Solflare and Backpack browse URLs for the live dapp', () => {
    expect(buildWalletBrowseUrl('Phantom', DAPP, ORIGIN)).toBe(
      `https://phantom.app/ul/browse/${encodeURIComponent(DAPP)}?ref=${encodeURIComponent(ORIGIN)}`,
    );
    expect(buildWalletBrowseUrl('Solflare', DAPP, ORIGIN)).toBe(
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(DAPP)}?ref=${encodeURIComponent(ORIGIN)}`,
    );
    expect(buildWalletBrowseUrl('Backpack', DAPP, ORIGIN)).toBe(
      `https://backpack.app/ul/v1/browse/${encodeURIComponent(DAPP)}?ref=${encodeURIComponent(ORIGIN)}`,
    );
    expect(buildWalletBrowseUrl('Unknown', DAPP, ORIGIN)).toBeNull();
  });

  it('keeps install URLs as a fallback, not the first hop', () => {
    expect(WALLET_INSTALL_URLS.Phantom).toBe('https://phantom.app/download');
    expect(WALLET_INSTALL_URLS.Backpack).toBe('https://backpack.app/download');
    expect(WALLET_INSTALL_URLS.Solflare).toBe('https://solflare.com/download');
  });
});
