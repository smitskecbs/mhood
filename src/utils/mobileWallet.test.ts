import { describe, expect, it } from 'vitest';
import {
  buildWalletBrowseUrl,
  canonicalDappUrl,
  detectInjectedWallets,
  detectMobileWalletContext,
  isInSolanaWalletBrowser,
  isMobileUserAgent,
  WALLET_INSTALL_URLS,
} from './mobileWallet';

const DAPP = 'https://mhood.cbs-coin.com';

describe('mobile wallet detection', () => {
  it('treats phones as mobile and desktops as not', () => {
    expect(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(false);
  });

  it('detects an in-app wallet browser from injected providers, not only user agent', () => {
    expect(detectInjectedWallets({ phantom: { solana: {} } }).phantom).toBe(true);
    expect(detectInjectedWallets({ backpack: {} }).backpack).toBe(true);
    expect(detectInjectedWallets({ solflare: {} }).solflare).toBe(true);
    expect(isInSolanaWalletBrowser({ phantom: true })).toBe(true);
    expect(isInSolanaWalletBrowser({ backpack: true })).toBe(true);
    expect(isInSolanaWalletBrowser({ solflare: true })).toBe(true);
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
  it('keeps the working Phantom browse universal link unchanged', () => {
    const encoded = encodeURIComponent(DAPP);
    expect(buildWalletBrowseUrl('Phantom', DAPP, DAPP)).toBe(
      `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`,
    );
    expect(buildWalletBrowseUrl('Phantom', DAPP, DAPP)).not.toContain('/ul/v1/browse/');
    expect(buildWalletBrowseUrl('Phantom', DAPP, DAPP)).not.toContain('phantom.app/download');
  });

  it('encodes the live dapp origin for Phantom, Solflare and Backpack browse routes', () => {
    const encoded = encodeURIComponent(DAPP);
    expect(canonicalDappUrl('https://mhood.cbs-coin.com/#gate', DAPP)).toBe(DAPP);
    expect(buildWalletBrowseUrl('Phantom', `${DAPP}/`, DAPP)).toBe(
      `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`,
    );
    expect(buildWalletBrowseUrl('Solflare', DAPP, DAPP)).toBe(
      `https://solflare.com/ul/v1/browse/${encoded}?ref=${encoded}`,
    );
    expect(buildWalletBrowseUrl('Backpack', DAPP, DAPP)).toBe(
      `https://backpack.app/ul/v1/browse/${encoded}?ref=${encoded}`,
    );
    expect(buildWalletBrowseUrl('Phantom', DAPP, DAPP)).toContain(encoded);
    expect(buildWalletBrowseUrl('Backpack', DAPP, DAPP)).toContain(encoded);
    expect(buildWalletBrowseUrl('Solflare', DAPP, DAPP)).toContain(encoded);
    expect(buildWalletBrowseUrl('Unknown', DAPP, DAPP)).toBeNull();
  });

  it('keeps install URLs as a fallback, not the first hop', () => {
    expect(WALLET_INSTALL_URLS.Phantom).toBe('https://phantom.app/download');
    expect(WALLET_INSTALL_URLS.Backpack).toBe('https://backpack.app/download');
    expect(WALLET_INSTALL_URLS.Solflare).toBe('https://solflare.com/download');
  });
});
