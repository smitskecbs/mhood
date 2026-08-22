import { describe, expect, it } from 'vitest';
import {
  getConfiguredRpcUrl,
  isRealBurnEnabled,
  parseRealBurnFlag,
  parseSolanaRpcUrl,
  RPC_NOT_CONFIGURED,
  requireConfiguredRpcUrl,
} from './env';
import { getConnection, getConnectionEndpoint, UNCONFIGURED_RPC_PLACEHOLDER } from '../services/solana/connection';

describe('Solana RPC env', () => {
  it('does not invent a public mainnet-beta fallback', () => {
    expect(parseSolanaRpcUrl('')).toBeNull();
    expect(parseSolanaRpcUrl('   ')).toBeNull();
    expect(parseSolanaRpcUrl(undefined)).toBeNull();
    expect(parseSolanaRpcUrl('not-a-url')).toBeNull();
    expect(parseSolanaRpcUrl('ftp://rpc.example.com')).toBeNull();
    expect(parseSolanaRpcUrl('https://my-provider.example/solana?api-key=secret')).toBe(
      'https://my-provider.example/solana?api-key=secret',
    );
  });

  it('uses a non-public placeholder when env RPC is empty', () => {
    expect(UNCONFIGURED_RPC_PLACEHOLDER).not.toContain('api.mainnet-beta.solana.com');
    const configured = getConfiguredRpcUrl();
    if (!configured) {
      expect(getConnectionEndpoint()).toBe(UNCONFIGURED_RPC_PLACEHOLDER);
      expect(() => requireConfiguredRpcUrl()).toThrow(RPC_NOT_CONFIGURED);
      expect(() => getConnection()).toThrow(RPC_NOT_CONFIGURED);
    } else {
      expect(getConnectionEndpoint()).toBe(configured);
      expect(requireConfiguredRpcUrl()).toBe(configured);
      expect(getConnection().rpcEndpoint).toBe(configured);
    }
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
