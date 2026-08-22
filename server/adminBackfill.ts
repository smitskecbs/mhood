import { authorizeBackfillRequest, backfillSecretFromEnv } from './backfillAuth.js';
import { backfillSeedSignatures } from './backfillVerifiedBurns.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import { KNOWN_MHOOD_BURN_SIGNATURES } from './knownMhoodBurns.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';

export type AdminBackfillBody = {
  mode?: unknown;
  signatures?: unknown;
};

function readSeedSignatures(body: unknown): string[] | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const signatures = (body as AdminBackfillBody).signatures;
  if (!Array.isArray(signatures)) return undefined;
  const parsed = signatures.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return parsed.length > 0 ? parsed : undefined;
}

function readMode(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'seed';
  const mode = (body as AdminBackfillBody).mode;
  return typeof mode === 'string' && mode.trim() ? mode.trim().toLowerCase() : 'seed';
}

export async function handleAdminBackfillRequest(input: {
  httpMethod: string;
  headers?: Headers | Record<string, string | string[] | undefined>;
  body?: unknown;
  env?: NodeJS.Dict<string>;
  store?: VerifiedBurnStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ status: number; body: unknown }> {
  if (input.httpMethod !== 'POST') {
    return { status: 404, body: { error: 'Not found' } };
  }

  const env = input.env ?? process.env;
  const secret = backfillSecretFromEnv(env);
  if (!authorizeBackfillRequest({ headers: input.headers }, secret)) {
    return { status: 404, body: { error: 'Not found' } };
  }

  const mode = readMode(input.body);
  if (mode !== 'seed') {
    return {
      status: 400,
      body: { error: 'Only seed backfill is available in this request.' },
    };
  }

  const rpcUrl = (env.HELIUS_RPC_URL ?? '').trim();
  if (!rpcUrl) {
    return { status: 503, body: { error: 'Solana RPC endpoint is not configured.' } };
  }

  const store = input.store ?? createVerifiedBurnStore(env, { fetchImpl: input.fetchImpl });
  if (store.persistence === 'inactive') {
    return { status: 503, body: { error: 'Persistent burn storage is not configured.' } };
  }

  const result = await backfillSeedSignatures({
    rpcUrl,
    store,
    signatures: readSeedSignatures(input.body) ?? [...KNOWN_MHOOD_BURN_SIGNATURES],
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
  });
  return {
    status: 200,
    body: {
      ok: true,
      mode: result.mode,
      persistence: store.persistence,
      verified: result.verified,
      inserted: result.inserted,
      alreadyIndexed: result.alreadyIndexed,
      failed: result.failed,
      records: result.records,
      failures: result.failures,
    },
  };
}
