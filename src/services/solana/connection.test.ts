import { Connection } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { getConfiguredRpcUrl, resolveClientRpcUrl } from '../../config/env';
import {
  getConnection,
  getConnectionEndpoint,
  safeHttpRpcEndpoint,
  UNCONFIGURED_RPC_PLACEHOLDER,
} from './connection';

describe('central Solana connection', () => {
  it('shares one configured RPC endpoint for mint, balance and burn reads', () => {
    const configured = getConfiguredRpcUrl();
    const endpoint = getConnectionEndpoint();
    if (!configured) {
      expect(endpoint).toBe(UNCONFIGURED_RPC_PLACEHOLDER);
      return;
    }
    expect(endpoint).toBe(configured);
    expect(endpoint.startsWith('http://') || endpoint.startsWith('https://')).toBe(true);
    expect(getConnection()).toBe(getConnection());
    expect(getConnection().rpcEndpoint).toBe(configured);
  });

  it('accepts the absolute production proxy URL', () => {
    const endpoint = resolveClientRpcUrl({
      isProd: true,
      origin: 'https://mhood.cbs-coin.com',
    });
    expect(() => new Connection(endpoint)).not.toThrow();
    expect(new Connection(endpoint).rpcEndpoint).toBe('https://mhood.cbs-coin.com/api/rpc');
  });

  it('falls back instead of crashing on a relative RPC path', () => {
    expect(safeHttpRpcEndpoint('/api/rpc')).toBe(UNCONFIGURED_RPC_PLACEHOLDER);
    expect(() => new Connection(safeHttpRpcEndpoint('/api/rpc'))).not.toThrow();
  });
});
