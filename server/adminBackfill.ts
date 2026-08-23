import { authorizeBackfillRequest, backfillSecretFromEnv } from './backfillAuth.js';
import {
  BackfillStageError,
  HANDLER_DEADLINE_MS,
  backfillLog,
  runWithDeadline,
  stageErrorBody,
} from './backfillLog.js';
import { backfillSeedSignatures } from './backfillVerifiedBurns.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import { KNOWN_MHOOD_BURN_SIGNATURES } from './knownMhoodBurns.js';
import { verifyBurnStoreHealth, type VerifiedBurnStore } from './verifiedBurnStore.js';

export { HANDLER_DEADLINE_MS };

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

async function parseRequestBody(request: Request | undefined): Promise<unknown> {
  if (!request || typeof request.json !== 'function') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request.json(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request body parse timeout')), 1_000);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeSeedBackfill(input: {
  headers?: Headers | Record<string, string | string[] | undefined>;
  body?: unknown;
  request?: Request;
  env: NodeJS.Dict<string>;
  store?: VerifiedBurnStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  upstashTimeoutMs?: number;
  signal: AbortSignal;
  started: number;
}): Promise<{ status: number; body: unknown }> {
  backfillLog('parsing request');
  const body = input.body !== undefined ? input.body : await parseRequestBody(input.request);
  backfillLog('request parsed');

  const secret = backfillSecretFromEnv(input.env);
  if (!authorizeBackfillRequest({ headers: input.headers }, secret)) {
    return { status: 404, body: { error: 'Not found' } };
  }
  backfillLog('auth ok');

  const mode = readMode(body);
  if (mode !== 'seed') {
    return {
      status: 400,
      body: { error: 'Only seed backfill is available in this request.' },
    };
  }

  const rpcUrl = (input.env.HELIUS_RPC_URL ?? '').trim();
  if (!rpcUrl) {
    return { status: 503, body: { error: 'Solana RPC endpoint is not configured.' } };
  }

  backfillLog('creating store');
  const store =
    input.store ??
    createVerifiedBurnStore(input.env, {
      fetchImpl: input.fetchImpl,
      upstashTimeoutMs: input.upstashTimeoutMs,
      signal: input.signal,
    });
  if (store.persistence === 'inactive') {
    return { status: 503, body: { error: 'Persistent burn storage is not configured.' } };
  }
  backfillLog('store created');

  backfillLog('store health start');
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
    signatures: readSeedSignatures(body) ?? [...KNOWN_MHOOD_BURN_SIGNATURES],
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    signal: input.signal,
  });
  backfillLog('complete', {
    verified: result.verified,
    inserted: result.inserted,
    alreadyIndexed: result.alreadyIndexed,
    failed: result.failed,
    durationMs: Date.now() - input.started,
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
      durationMs: Date.now() - input.started,
    },
  };
}

export async function handleAdminBackfillRequest(input: {
  httpMethod: string;
  headers?: Headers | Record<string, string | string[] | undefined>;
  body?: unknown;
  request?: Request;
  env?: NodeJS.Dict<string>;
  store?: VerifiedBurnStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  upstashTimeoutMs?: number;
  deadlineMs?: number;
}): Promise<{ status: number; body: unknown }> {
  const started = Date.now();
  if (input.httpMethod !== 'POST') {
    return { status: 404, body: { error: 'Not found' } };
  }

  try {
    return await runWithDeadline(
      (signal) =>
        executeSeedBackfill({
          headers: input.headers,
          body: input.body,
          request: input.request,
          env: input.env ?? process.env,
          store: input.store,
          fetchImpl: input.fetchImpl,
          timeoutMs: input.timeoutMs,
          upstashTimeoutMs: input.upstashTimeoutMs,
          signal,
          started,
        }),
      input.deadlineMs ?? HANDLER_DEADLINE_MS,
    );
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
