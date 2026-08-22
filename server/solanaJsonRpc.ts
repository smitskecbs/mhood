const RPC_TIMEOUT_MS = 20_000;

export async function solanaJsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as { result?: T; error?: { message?: string } };
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || `RPC ${method} failed (${response.status})`);
    }
    return payload.result as T;
  } finally {
    clearTimeout(timer);
  }
}

export type SignatureInfo = {
  signature: string;
  err?: unknown;
  slot?: number;
  blockTime?: number | null;
};

export async function listSignaturesForAddress(
  rpcUrl: string,
  address: string,
  options?: { limit?: number; maxPages?: number; fetchImpl?: typeof fetch },
): Promise<string[]> {
  const limit = options?.limit ?? 1000;
  const maxPages = options?.maxPages ?? 3;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const signatures: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const params: unknown[] = before
      ? [address, { limit, before }]
      : [address, { limit }];
    const batch = await solanaJsonRpc<SignatureInfo[]>(rpcUrl, 'getSignaturesForAddress', params, fetchImpl);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const item of batch) {
      if (item?.signature && item.err == null) signatures.push(item.signature);
    }
    if (batch.length < limit) break;
    before = batch[batch.length - 1]?.signature;
    if (!before) break;
  }
  return signatures;
}
