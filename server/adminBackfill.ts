import { authorizeBackfillRequest, backfillSecretFromEnv } from './backfillAuth.js';
import { BackfillStageError, backfillLog, stageErrorBody } from './backfillLog.js';
import { backfillSeedSignatures } from './backfillVerifiedBurns.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import { KNOWN_MHOOD_BURN_SIGNATURES } from './knownMhoodBurns.js';
import { verifyBurnStoreHealth, type VerifiedBurnStore } from './verifiedBurnStore.js';

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
  upstashTimeoutMs?: number;
}): Promise<{ status: number; body: unknown }> {
  const started = Date.now();
  if (input.httpMethod !== 'POST') {
    return { status: 404, body: { error: 'Not found' } };
  }

  backfillLog('request start');

  const env = input.env ?? process.env;
  const secret = backfillSecretFromEnv(env);
  if (!authorizeBackfillRequest({ headers: input.headers }, secret)) {
    return { status: 404, body: { error: 'Not found' } };
  }
  backfillLog('auth ok');

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

  try {
    const store =
      input.store ??
      createVerifiedBurnStore(env, {
        fetchImpl: input.fetchImpl,
        upstashTimeoutMs: input.upstashTimeoutMs,
      });
    if (store.persistence === 'inactive') {
      return { status: 503, body: { error: 'Persistent burn storage is not configured.' } };
    }
    backfillLog(`store selected: ${store.kind}`);

    try {
      await verifyBurnStoreHealth(store);
    } catch (err) {
      throw err instanceof BackfillStageError
        ? err
        : new BackfillStageError(
            'store-health',
            err instanceof Error ? err.message : 'Store health check failed',
            503,
          );
    }
    backfillLog('store health ok');

    const result = await backfillSeedSignatures({
      rpcUrl,
      store,
      signatures: readSeedSignatures(input.body) ?? [...KNOWN_MHOOD_BURN_SIGNATURES],
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
    });
    backfillLog('complete', {
      verified: result.verified,
      inserted: result.inserted,
      alreadyIndexed: result.alreadyIndexed,
      failed: result.failed,
      durationMs: Date.now() - started,
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
        durationMs: Date.now() - started,
      },
    };
  } catch (err) {
    const stageErr =
      err instanceof BackfillStageError
        ? err
        : new BackfillStageError(
            'unexpected',
            err instanceof Error ? err.message : 'Backfill failed',
            500,
          );
    backfillLog(`failed stage=${stageErr.stage} error=${stageErr.message} durationMs=${Date.now() - started}`);
    return { status: stageErr.status, body: stageErrorBody(stageErr) };
  }
}
