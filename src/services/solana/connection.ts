import { Connection } from '@solana/web3.js';
import { clientUsesRpcProxy, getConfiguredRpcUrl, requireConfiguredRpcUrl, RPC_PROXY_PATH } from '../../config/env';
import { redactRpcUrl } from '../../utils/devLog';

/**
 * Placeholder used only so WalletProvider can mount when env RPC is empty.
 * Real holder/mint/burn reads must call requireConfiguredRpcUrl() first and
 * never silently switch to api.mainnet-beta.solana.com.
 */
export const UNCONFIGURED_RPC_PLACEHOLDER = 'https://unconfigured.invalid';

let connection: Connection | null = null;
let connectionEndpoint: string | null = null;
let loggedClientEndpoint = false;

function logClientRpcEndpoint(endpoint: string): void {
  if (loggedClientEndpoint) return;
  loggedClientEndpoint = true;
  const label = clientUsesRpcProxy(endpoint) ? RPC_PROXY_PATH : redactRpcUrl(endpoint);
  console.info(`[MoginHood] client RPC endpoint: ${label}`);
}

export function getConnectionEndpoint(): string {
  const endpoint = getConfiguredRpcUrl() ?? UNCONFIGURED_RPC_PLACEHOLDER;
  logClientRpcEndpoint(endpoint);
  return endpoint;
}

export function getConnection(): Connection {
  const endpoint = requireConfiguredRpcUrl();
  logClientRpcEndpoint(endpoint);
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
