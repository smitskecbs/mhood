export const RPC_TIMEOUT_MS = 20_000;

/**
 * Solana / Helius methods this app actually uses:
 * mint lookup, holder balances, DAS ranking, burn send/confirm/verify.
 */
export const ALLOWED_RPC_METHODS = new Set([
  'getAccountInfo',
  'getMultipleAccounts',
  'getTokenAccountsByOwner',
  'getTokenAccounts',
  'getLatestBlockhash',
  'getRecentBlockhash',
  'getSignatureStatuses',
  'getTransaction',
  'sendTransaction',
  'simulateTransaction',
  'getFeeForMessage',
  'getBlockHeight',
  'getBalance',
  'getSlot',
  'isBlockhashValid',
  'getHealth',
  'getEpochInfo',
]);

export function isRpcMethodAllowed(method: string): boolean {
  return ALLOWED_RPC_METHODS.has(method);
}

export function sanitizeRpcLogText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"'\\]*helius[^\s"'\\]*/gi, '[rpc-host]')
    .replace(/[?&]api-key=[^&\s"']+/gi, '')
    .replace(/api[-_]?key=[^&\s"']+/gi, 'api-key=[redacted]');
}

export function extractRpcMethod(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const method = (body as { method?: unknown }).method;
  return typeof method === 'string' && method.trim() ? method.trim() : null;
}

export function extractRpcId(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return (body as { id?: unknown }).id ?? null;
}

export async function handleJsonRpcProxy(input: {
  httpMethod: string;
  body: unknown;
  upstreamUrl: string | undefined;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}): Promise<{ status: number; body: unknown }> {
  const log = input.log ?? ((message: string) => console.info(message));

  if (input.httpMethod !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  if (!input.upstreamUrl?.trim()) {
    log('[MoginHood RPC] upstream status: 500');
    return { status: 500, body: { error: 'RPC upstream is not configured.' } };
  }

  if (Array.isArray(input.body)) {
    return { status: 400, body: { error: 'JSON-RPC batches are not supported.' } };
  }

  const method = extractRpcMethod(input.body);
  if (!method) {
    return {
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid JSON-RPC request' },
      },
    };
  }

  log(`[MoginHood RPC] method: ${method}`);

  if (!isRpcMethodAllowed(method)) {
    return {
      status: 403,
      body: {
        jsonrpc: '2.0',
        id: extractRpcId(input.body),
        error: { code: -32601, message: 'Method not allowed' },
      },
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(input.upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    log(`[MoginHood RPC] upstream status: ${response.status}`);
    const json = (await response.json().catch(() => ({ error: 'Invalid upstream JSON' }))) as unknown;
    return { status: response.status, body: json };
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Upstream RPC failed';
    const timeout = err instanceof Error && (err.name === 'TimeoutError' || /timeout/i.test(err.message));
    log(`[MoginHood RPC] method: ${method} error: ${sanitizeRpcLogText(raw)}`);
    log(`[MoginHood RPC] upstream status: ${timeout ? 504 : 502}`);
    return {
      status: timeout ? 504 : 502,
      body: { error: 'RPC upstream request failed.' },
    };
  }
}
