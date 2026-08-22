import { Connection } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import {
  clientUsesRpcProxy,
  getConfiguredRpcUrl,
  isHttpRpcEndpoint,
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

  it('uses an absolute same-origin proxy in production even if a Helius URL is present', () => {
    const endpoint = resolveClientRpcUrl({
      isProd: true,
      envUrl: 'https://mainnet.helius-rpc.com/?api-key=super-secret',
      origin: 'https://mhood.cbs-coin.com',
    });
    expect(endpoint).toBe('https://mhood.cbs-coin.com/api/rpc');
    expect(endpoint.startsWith('https://')).toBe(true);
    expect(endpoint.endsWith('/api/rpc')).toBe(true);
    expect(endpoint).not.toContain('helius');
    expect(endpoint).not.toContain('api-key');
    expect(clientUsesRpcProxy(endpoint)).toBe(true);
    expect(clientUsesRpcProxy(RPC_PROXY_PATH)).toBe(true);
    expect(clientUsesRpcProxy('https://mainnet.helius-rpc.com/?api-key=super-secret')).toBe(false);
  });

  it('builds the production proxy from a preview origin', () => {
    expect(
      resolveClientRpcUrl({
        isProd: true,
        origin: 'https://mhood-git-fix-rpc.vercel.app',
      }),
    ).toBe('https://mhood-git-fix-rpc.vercel.app/api/rpc');
  });

  it('allows a direct development RPC URL', () => {
    expect(
      resolveClientRpcUrl({
        isProd: false,
        envUrl: 'https://example-rpc.test/solana',
        origin: 'http://localhost:5173',
      }),
    ).toBe('https://example-rpc.test/solana');
  });

  it('falls back to the local origin proxy in development when env RPC is empty', () => {
    expect(
      resolveClientRpcUrl({
        isProd: false,
        envUrl: '',
        origin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173/api/rpc');
  });

  it('uses window.location.origin for production when no origin is passed', () => {
    const endpoint = resolveClientRpcUrl({
      isProd: true,
      envUrl: 'https://mainnet.helius-rpc.com/?api-key=preview-secret',
    });
    expect(endpoint).toBe(`${window.location.origin}/api/rpc`);
    expect(endpoint).not.toContain('helius');
    expect(endpoint).not.toContain('api-key');
  });

  it('lets Connection accept the production proxy URL', () => {
    const endpoint = resolveClientRpcUrl({
      isProd: true,
      origin: 'https://mhood.cbs-coin.com',
    });
    expect(isHttpRpcEndpoint(endpoint)).toBe(true);
    expect(() => new Connection('/api/rpc')).toThrow(/http:|https:/);
    expect(() => new Connection(endpoint)).not.toThrow();
    expect(new Connection(endpoint).rpcEndpoint).toBe(endpoint);
  });

  it('shares one configured RPC endpoint for mint, balance and burn reads', () => {
    expect(UNCONFIGURED_RPC_PLACEHOLDER).not.toContain('api.mainnet-beta.solana.com');
    const configured = getConfiguredRpcUrl();
    expect(configured).toBeTruthy();
    expect(configured && isHttpRpcEndpoint(configured)).toBe(true);
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
