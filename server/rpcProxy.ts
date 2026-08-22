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
  'getVersion',
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

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(ms), clear: () => undefined };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
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
    log('[MoginHood RPC] HELIUS_RPC_URL missing');
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
    log(`[MoginHood RPC] upstream status: 403`);
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
  const timeout = timeoutSignal(RPC_TIMEOUT_MS);
  try {
    const response = await fetchImpl(input.upstreamUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.body),
      signal: timeout.signal,
    });
    log(`[MoginHood RPC] upstream status: ${response.status}`);
    const json = (await response.json().catch(() => ({ error: 'Invalid upstream JSON' }))) as unknown;
    return { status: response.status, body: json };
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Upstream RPC failed';
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || /timeout|aborted/i.test(err.message));
    log(`[MoginHood RPC] method: ${method} error: ${sanitizeRpcLogText(raw)}`);
    log(`[MoginHood RPC] upstream status: ${timedOut ? 504 : 502}`);
    return {
      status: timedOut ? 504 : 502,
      body: { error: 'RPC upstream request failed.' },
    };
  } finally {
    timeout.clear();
  }
}

export function jsonRpcHttpResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Web Request/Response adapter for Vercel Functions. No Node req/res, no Vite env. */
export async function rpcProxyFromRequest(
  request: Request,
  env: { HELIUS_RPC_URL?: string } = typeof process !== 'undefined' ? process.env : {},
  fetchImpl?: typeof fetch,
): Promise<Response> {
  let body: unknown = null;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return jsonRpcHttpResponse(400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid JSON-RPC request' },
      });
    }
  }

  const result = await handleJsonRpcProxy({
    httpMethod: request.method,
    body,
    upstreamUrl: env.HELIUS_RPC_URL,
    fetchImpl,
  });
  return jsonRpcHttpResponse(result.status, result.body);
}
