import { Connection } from '@solana/web3.js';
import { getConfiguredRpcUrl, isHttpRpcEndpoint, requireConfiguredRpcUrl } from '../../config/env';
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
  console.info(`[MoginHood] client RPC endpoint: ${redactRpcUrl(endpoint)}`);
}

export function safeHttpRpcEndpoint(url: string): string {
  return isHttpRpcEndpoint(url) ? url : UNCONFIGURED_RPC_PLACEHOLDER;
}

export function getConnectionEndpoint(): string {
  try {
    const configured = getConfiguredRpcUrl();
    const endpoint = configured ? safeHttpRpcEndpoint(configured) : UNCONFIGURED_RPC_PLACEHOLDER;
    logClientRpcEndpoint(endpoint);
    return endpoint;
  } catch {
    logClientRpcEndpoint(UNCONFIGURED_RPC_PLACEHOLDER);
    return UNCONFIGURED_RPC_PLACEHOLDER;
  }
}

export function getConnection(): Connection {
  const endpoint = requireConfiguredRpcUrl();
  if (!isHttpRpcEndpoint(endpoint)) {
    throw new Error('Endpoint URL must start with `http:` or `https:`.');
  }
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
  loggedClientEndpoint = false;
}
