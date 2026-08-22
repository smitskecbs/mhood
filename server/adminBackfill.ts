import { authorizeBackfillRequest, backfillSecretFromEnv } from './backfillAuth.js';
import { backfillVerifiedBurns } from './backfillVerifiedBurns.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';

export async function handleAdminBackfillRequest(input: {
  httpMethod: string;
  headers?: Headers | Record<string, string | string[] | undefined>;
  env?: NodeJS.Dict<string>;
  store?: VerifiedBurnStore;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; body: unknown }> {
  if (input.httpMethod !== 'POST') {
    return { status: 404, body: { error: 'Not found' } };
  }

  const env = input.env ?? process.env;
  const secret = backfillSecretFromEnv(env);
  if (!authorizeBackfillRequest({ headers: input.headers }, secret)) {
    return { status: 404, body: { error: 'Not found' } };
  }

  const rpcUrl = (env.HELIUS_RPC_URL ?? '').trim();
  if (!rpcUrl) {
    return { status: 503, body: { error: 'Solana RPC endpoint is not configured.' } };
  }

  const store = input.store ?? createVerifiedBurnStore(env, { fetchImpl: input.fetchImpl });
  if (store.persistence === 'inactive') {
    return { status: 503, body: { error: 'Persistent burn storage is not configured.' } };
  }

  const result = await backfillVerifiedBurns({
    rpcUrl,
    store,
    fetchImpl: input.fetchImpl,
  });
  return {
    status: 200,
    body: {
      ok: true,
      persistence: store.persistence,
      scanned: result.scanned,
      imported: result.imported.length,
      duplicates: result.duplicates.length,
      rejected: result.rejected.length,
      records: result.imported,
    },
  };
}
