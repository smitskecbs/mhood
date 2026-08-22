import { heliusRpc } from './solanaJsonRpc.js';

type SignatureInfo = {
  signature: string;
  err?: unknown;
};

/**
 * Optional paginated history scan. Not used by the admin seed backfill request.
 */
export async function listSignaturesForAddress(
  rpcUrl: string,
  address: string,
  options?: { limit?: number; maxPages?: number; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<string[]> {
  const limit = options?.limit ?? 1000;
  const maxPages = options?.maxPages ?? 3;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const signatures: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const params: unknown[] = before ? [address, { limit, before }] : [address, { limit }];
    const batch = await heliusRpc<SignatureInfo[]>(
      'getSignaturesForAddress',
      params,
      { rpcUrl, fetchImpl, timeoutMs: options?.timeoutMs },
    );
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

export async function collectHistorySignatures(input: {
  rpcUrl: string;
  addresses: readonly string[];
  fetchImpl?: typeof fetch;
  listSignatures?: (address: string) => Promise<string[]>;
}): Promise<string[]> {
  const found = new Set<string>();
  const list =
    input.listSignatures ??
    ((address: string) =>
      listSignaturesForAddress(input.rpcUrl, address, { fetchImpl: input.fetchImpl }));
  for (const address of input.addresses) {
    const signatures = await list(address);
    for (const signature of signatures) found.add(signature);
  }
  return [...found];
}
