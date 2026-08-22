export const FOREST_DAPP_ORIGIN = 'https://mhood.cbs-coin.com';

export function isMobileUserAgent(ua: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

type InjectedWalletWindow = {
  phantom?: { solana?: unknown };
  backpack?: unknown;
  xnft?: unknown;
  solflare?: unknown;
  solana?: { isPhantom?: boolean; isSolflare?: boolean; isBackpack?: boolean };
  navigator?: { wallets?: unknown };
};

export function detectInjectedWallets(win: InjectedWalletWindow): {
  phantom: boolean;
  backpack: boolean;
  solflare: boolean;
} {
  return {
    phantom: Boolean(win.phantom?.solana || win.solana?.isPhantom),
    backpack: Boolean(win.backpack || win.xnft || win.solana?.isBackpack),
    solflare: Boolean(win.solflare || win.solana?.isSolflare),
  };
}

export function isInSolanaWalletBrowser(input: {
  ua?: string;
  phantom?: boolean;
  backpack?: boolean;
  solflare?: boolean;
}): boolean {
  if (input.phantom || input.backpack || input.solflare) return true;
  return /Phantom|Solflare|Backpack/i.test(input.ua ?? '');
}

export function detectMobileWalletContext(input?: { ua?: string; win?: InjectedWalletWindow }): {
  mobile: boolean;
  inWalletBrowser: boolean;
} {
  const ua = input?.ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const win = input?.win ?? (typeof window !== 'undefined' ? (window as InjectedWalletWindow) : undefined);
  const injected = win ? detectInjectedWallets(win) : { phantom: false, backpack: false, solflare: false };
  return {
    mobile: isMobileUserAgent(ua),
    inWalletBrowser: isInSolanaWalletBrowser({ ua, ...injected }),
  };
}

export const WALLET_INSTALL_URLS: Record<string, string> = {
  Backpack: 'https://backpack.app/download',
  Phantom: 'https://phantom.app/download',
  Solflare: 'https://solflare.com/download',
};

/** Origin only: wallets open this URL in their in-app browser. No path/hash/query. */
export function canonicalDappUrl(href?: string, origin?: string): string {
  const candidate = origin || href || (typeof window !== 'undefined' ? window.location.origin : FOREST_DAPP_ORIGIN);
  try {
    return new URL(candidate).origin;
  } catch {
    return FOREST_DAPP_ORIGIN;
  }
}

/**
 * Official browse universal links. The path segment is the URL-encoded dapp URL.
 * These must be opened by a real user click on an `<a href>` (not a JS redirect).
 * @see https://docs.phantom.com/phantom-deeplinks/other-methods/browse
 * @see https://docs.solflare.com/solflare/technical/deeplinks/other-methods/browse
 * @see https://docs.backpack.app/deeplinks/other-methods/browse
 */
export function buildWalletBrowseUrl(walletName: string, dappUrl: string, refOrigin: string): string | null {
  const target = canonicalDappUrl(dappUrl, refOrigin);
  const encodedUrl = encodeURIComponent(target);
  const encodedRef = encodeURIComponent(target);
  switch (walletName) {
    case 'Phantom':
      return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedRef}`;
    case 'Solflare':
      return `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${encodedRef}`;
    case 'Backpack':
      return `https://backpack.app/ul/v1/browse/${encodedUrl}?ref=${encodedRef}`;
    default:
      return null;
  }
}
