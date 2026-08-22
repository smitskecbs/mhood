import { Connection } from '@solana/web3.js';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveClientRpcUrl } from '../config/env';
import { safeHttpRpcEndpoint, UNCONFIGURED_RPC_PLACEHOLDER } from '../services/solana/connection';
import { SolanaProviders } from './providers';

vi.mock('../config/wallets', async () => {
  const actual = await vi.importActual<typeof import('../config/wallets')>('../config/wallets');
  return {
    ...actual,
    createSupportedWalletAdapters: () => [],
  };
});

describe('production RPC config does not black-screen the app', () => {
  it('rejects a relative proxy path that Connection cannot construct', () => {
    expect(() => new Connection('/api/rpc')).toThrow(/must start with `http:` or `https:`/);
    expect(safeHttpRpcEndpoint('/api/rpc')).toBe(UNCONFIGURED_RPC_PLACEHOLDER);
    expect(() => new Connection(safeHttpRpcEndpoint('/api/rpc'))).not.toThrow();
  });

  it('renders the app with the absolute production proxy endpoint', () => {
    const endpoint = resolveClientRpcUrl({
      isProd: true,
      origin: 'https://mhood.cbs-coin.com',
    });
    expect(endpoint.startsWith('https://')).toBe(true);
    expect(endpoint.endsWith('/api/rpc')).toBe(true);
    expect(() => new Connection(endpoint)).not.toThrow();

    render(
      <SolanaProviders>
        <div>forest-ok</div>
      </SolanaProviders>,
    );
    expect(screen.getByText('forest-ok')).toBeInTheDocument();
  });
});
