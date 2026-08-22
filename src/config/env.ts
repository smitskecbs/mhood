const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);

export const RPC_PROXY_PATH = '/api/rpc';
export const RPC_NOT_CONFIGURED = 'Solana RPC endpoint is not configured.';

function readEnv(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  return TRUE_VALUES.has(value.toLowerCase());
}

/** Env flags arrive as strings. `"true"` must not be confused with boolean `true`. */
export function parseRealBurnFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  return TRUE_VALUES.has(trimmed);
}

export function parseSolanaRpcUrl(value: string | undefined | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

function developmentRpcFromEnv(): string {
  if (import.meta.env.PROD) return '';
  return readEnv('VITE_SOLANA_RPC_URL');
}

/**
 * Production always uses the same-origin `/api/rpc` proxy (relative, never Helius).
 * Development may still point at a direct RPC URL from `.env` for local convenience.
 */
export function resolveClientRpcUrl(options?: {
  isProd?: boolean;
  envUrl?: string;
  origin?: string;
}): string {
  const isProd = options?.isProd ?? import.meta.env.PROD;

  if (isProd) {
    return RPC_PROXY_PATH;
  }

  const parsed = parseSolanaRpcUrl(options?.envUrl ?? developmentRpcFromEnv());
  if (parsed && parsed !== RPC_PROXY_PATH && !parsed.startsWith('/')) {
    return parsed;
  }
  return RPC_PROXY_PATH;
}

export const appConfig = {
  /**
   * Browser RPC. Production is always the relative same-origin proxy `/api/rpc`.
   */
  rpcUrl: resolveClientRpcUrl(),
  mintAddress: readEnv(
    'VITE_MHOOD_MINT',
    'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  ),
  /**
   * Human-readable UI threshold, e.g. 1000000 = 1,000,000 MHOOD.
   * Converted to raw units only after on-chain decimals are known.
   */
  accessThresholdUi: readEnv('VITE_MHOOD_ACCESS_THRESHOLD', '1000000'),
  /**
   * SAFETY DEFAULT: real burns are off.
   * A missing env value must never enable mainnet burns.
   */
  enableRealBurn: parseRealBurnFlag(readEnv('VITE_ENABLE_REAL_BURN', 'false')),
  /**
   * DEV-only skip of the 1M threshold. Default false.
   * Production builds ignore this even if the env var is present.
   */
  devBypassGate: parseBoolean(readEnv('VITE_DEV_BYPASS_GATE', 'false'), false),
  rankingSource: (readEnv('VITE_RANKING_SOURCE', 'mock') || 'mock') as
    | 'mock'
    | 'indexer'
    | 'rpc',
  holderIndexerUrl: readEnv('VITE_HOLDER_INDEXER_URL'),
  burnIndexerUrl: readEnv('VITE_BURN_INDEXER_URL'),
  explorerTxUrl: readEnv('VITE_EXPLORER_TX_URL', 'https://solscan.io/tx/'),
};

export function getConfiguredRpcUrl(): string | null {
  const url = resolveClientRpcUrl();
  return url || null;
}

export function requireConfiguredRpcUrl(): string {
  const url = getConfiguredRpcUrl();
  if (!url) {
    throw new Error(RPC_NOT_CONFIGURED);
  }
  return url;
}

export function isRealBurnEnabled(): boolean {
  return parseRealBurnFlag(import.meta.env.VITE_ENABLE_REAL_BURN) === true;
}

export function isDevBypassGateEnabled(): boolean {
  return import.meta.env.DEV && appConfig.devBypassGate === true;
}

export function rpcLooksLikeMainnet(url: string): boolean {
  const normalized = url.toLowerCase();
  return !normalized.includes('devnet') && !normalized.includes('testnet');
}

export function clientUsesRpcProxy(url: string): boolean {
  return url === RPC_PROXY_PATH || url.endsWith(RPC_PROXY_PATH);
}
