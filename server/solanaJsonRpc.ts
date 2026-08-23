import { fetchJsonWithTimeout } from './fetchWithTimeout.js';

const RPC_TIMEOUT_MS = 8_000;

export async function solanaJsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = RPC_TIMEOUT_MS,
  onResponse?: (status: number, durationMs: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const started = Date.now();
  const timeoutMessage = `RPC ${method} timed out`;
  const { ok, status, payload } = await fetchJsonWithTimeout(
    fetchImpl,
    rpcUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal,
    },
    timeoutMs,
    timeoutMessage,
  );
  onResponse?.(status, Date.now() - started);
  const body = payload as { result?: T; error?: { message?: string } };
  if (!ok || body.error) {
    throw new Error(body.error?.message || `RPC ${method} failed (${status})`);
  }
  return body.result as T;
}

export async function heliusRpc<T>(
  method: string,
  params: unknown[],
  options?: {
    rpcUrl?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    onResponse?: (status: number, durationMs: number) => void;
    signal?: AbortSignal;
  },
): Promise<T> {
  const rpcUrl = (options?.rpcUrl ?? process.env.HELIUS_RPC_URL ?? '').trim();
  if (!rpcUrl) {
    throw new Error('Solana RPC endpoint is not configured.');
  }
  return solanaJsonRpc<T>(
    rpcUrl,
    method,
    params,
    options?.fetchImpl ?? fetch,
    options?.timeoutMs ?? RPC_TIMEOUT_MS,
    options?.onResponse,
    options?.signal,
  );
}
