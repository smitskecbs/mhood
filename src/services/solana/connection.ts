import { Connection } from '@solana/web3.js';
import { getConfiguredRpcUrl, requireConfiguredRpcUrl } from '../../config/env';

/**
 * Placeholder used only so WalletProvider can mount when env RPC is empty.
 * Real holder/mint/burn reads must call requireConfiguredRpcUrl() first and
 * never silently switch to api.mainnet-beta.solana.com.
 */
export const UNCONFIGURED_RPC_PLACEHOLDER = 'https://unconfigured.invalid';

let connection: Connection | null = null;
let connectionEndpoint: string | null = null;

export function getConnectionEndpoint(): string {
  return getConfiguredRpcUrl() ?? UNCONFIGURED_RPC_PLACEHOLDER;
}

export function getConnection(): Connection {
  const endpoint = requireConfiguredRpcUrl();
  if (!connection || connectionEndpoint !== endpoint) {
    connection = new Connection(endpoint, { commitment: 'confirmed' });
    connectionEndpoint = endpoint;
  }
  return connection;
}

export function resetConnection(): void {
  connection = null;
  connectionEndpoint = null;
}
