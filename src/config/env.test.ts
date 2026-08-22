import { describe, expect, it } from 'vitest';
import {
  clientUsesRpcProxy,
  getConfiguredRpcUrl,
  isRealBurnEnabled,
  parseRealBurnFlag,
  parseSolanaRpcUrl,
  requireConfiguredRpcUrl,
  resolveClientRpcUrl,
  RPC_PROXY_PATH,
} from './env';
import { getConnection, getConnectionEndpoint, UNCONFIGURED_RPC_PLACEHOLDER } from '../services/solana/connection';

describe('Solana RPC env', () => {
  it('does not invent a public mainnet-beta fallback', () => {
    expect(parseSolanaRpcUrl('')).toBeNull();
    expect(parseSolanaRpcUrl('   ')).toBeNull();
    expect(parseSolanaRpcUrl(undefined)).toBeNull();
    expect(parseSolanaRpcUrl('not-a-url')).toBeNull();
    expect(parseSolanaRpcUrl('ftp://rpc.example.com')).toBeNull();
    expect(parseSolanaRpcUrl('/api/rpc')).toBe('/api/rpc');
    expect(parseSolanaRpcUrl('https://my-provider.example/solana?api-key=secret')).toBe(
      'https://my-provider.example/solana?api-key=secret',
    );
  });

  it('uses the same-origin proxy in production even if a Helius URL is present', () => {
    expect(
      resolveClientRpcUrl({
        isProd: true,
        envUrl: 'https://mainnet.helius-rpc.com/?api-key=super-secret',
        origin: 'https://mhood.cbs-coin.com',
      }),
    ).toBe('https://mhood.cbs-coin.com/api/rpc');
    expect(clientUsesRpcProxy('https://mhood.cbs-coin.com/api/rpc')).toBe(true);
    expect(clientUsesRpcProxy(RPC_PROXY_PATH)).toBe(true);
    expect(clientUsesRpcProxy('https://mainnet.helius-rpc.com/?api-key=super-secret')).toBe(false);
  });

  it('shares one configured RPC endpoint for mint, balance and burn reads', () => {
    expect(UNCONFIGURED_RPC_PLACEHOLDER).not.toContain('api.mainnet-beta.solana.com');
    const configured = getConfiguredRpcUrl();
    expect(configured).toBeTruthy();
    expect(getConnectionEndpoint()).toBe(configured);
    expect(requireConfiguredRpcUrl()).toBe(configured);
    expect(getConnection().rpcEndpoint).toBe(configured);
  });

  it('parses the real-burn flag from strings without treating "true" as a boolean', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(parseRealBurnFlag('')).toBe(false);
    expect(parseRealBurnFlag('false')).toBe(false);
    expect(parseRealBurnFlag('true')).toBe(true);
    expect(parseRealBurnFlag('TRUE')).toBe(true);
    expect(parseRealBurnFlag(true)).toBe(true);
    expect(parseRealBurnFlag(false)).toBe(false);
    expect(isRealBurnEnabled()).toBe(parseRealBurnFlag(import.meta.env.VITE_ENABLE_REAL_BURN));
  });
});
