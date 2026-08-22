const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);

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

export const RPC_NOT_CONFIGURED = 'Solana RPC endpoint is not configured.';

export function parseSolanaRpcUrl(value: string | undefined | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export const appConfig = {
  /**
   * Mainnet RPC from env only. Empty/invalid is not replaced by a public endpoint.
   */
  rpcUrl: parseSolanaRpcUrl(readEnv('VITE_SOLANA_RPC_URL')) ?? '',
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
  return parseSolanaRpcUrl(appConfig.rpcUrl);
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
