import { describe, expect, it } from 'vitest';
import { getConfiguredRpcUrl } from '../../config/env';
import { getConnection, getConnectionEndpoint } from './connection';

describe('central Solana connection', () => {
  it('shares one configured RPC endpoint for mint, balance and burn reads', () => {
    const configured = getConfiguredRpcUrl();
    const endpoint = getConnectionEndpoint();
    if (!configured) {
      expect(endpoint).toBe('https://unconfigured.invalid');
      return;
    }
    expect(endpoint).toBe(configured);
    expect(getConnection()).toBe(getConnection());
    expect(getConnection().rpcEndpoint).toBe(configured);
  });
});
