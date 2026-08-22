const RPC_TIMEOUT_MS = 8_000;

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export async function solanaJsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutMessage = `RPC ${method} timed out`;
  let rejectTimeout: ((err: Error) => void) | undefined;
  const timer = setTimeout(() => {
    controller.abort();
    rejectTimeout?.(new Error(timeoutMessage));
  }, timeoutMs);
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const fetchPromise = fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: controller.signal,
  });
  void fetchPromise.catch(() => undefined);

  try {
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    const payload = (await response.json()) as { result?: T; error?: { message?: string } };
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || `RPC ${method} failed (${response.status})`);
    }
    return payload.result as T;
  } catch (err) {
    if (isAbortError(err) || (err instanceof Error && err.message === timeoutMessage)) {
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function heliusRpc<T>(
  method: string,
  params: unknown[],
  options?: { rpcUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number },
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
  );
}
