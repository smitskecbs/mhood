import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { readJsonBody, sendJson } from './httpJson.js';
import { handleJsonRpcProxy } from './rpcProxy.js';
import { authorizeBackfillRequest } from './backfillAuth.js';
import { handleVerifiedBurnsRequest } from './verifiedBurnsApi.js';
import { createVerifiedBurnStore } from './createVerifiedBurnStore.js';
import { backfillSeedSignatures } from './backfillVerifiedBurns.js';

function mergedEnv(root: string, mode: string): NodeJS.Dict<string> {
  return { ...process.env, ...loadEnv(mode, root, '') };
}

function upstreamRpcUrl(env: NodeJS.Dict<string>): string {
  const helius = (env.HELIUS_RPC_URL || '').trim();
  if (helius) return helius;
  const vite = (env.VITE_SOLANA_RPC_URL || '').trim();
  if (vite && !vite.startsWith('/')) return vite;
  return '';
}

export function moginhoodApiPlugin(): Plugin {
  return {
    name: 'moginhood-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        const root = server.config.root;
        const mode = server.config.mode;
        const env = mergedEnv(root, mode);

        if (url === '/api/rpc') {
          void handleRpc(req, res, env).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Invalid JSON-RPC request.';
            sendJson(res, 400, { error: message });
          });
          return;
        }

        if (url === '/api/verified-burns') {
          void handleBurns(req, res, root, env).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
            sendJson(res, 500, { error: message });
          });
          return;
        }

        if (url === '/api/admin/backfill-burns') {
          void handleBackfill(req, res, root, env).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Backfill failed.';
            sendJson(res, 500, { error: message });
          });
          return;
        }

        next();
      });
    },
  };
}

async function handleRpc(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.Dict<string>,
): Promise<void> {
  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  const result = await handleJsonRpcProxy({
    httpMethod: req.method ?? 'GET',
    body,
    upstreamUrl: upstreamRpcUrl(env) || undefined,
  });
  sendJson(res, result.status, result.body);
}

async function handleBurns(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  env: NodeJS.Dict<string>,
): Promise<void> {
  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  const result = await handleVerifiedBurnsRequest({
    httpMethod: req.method ?? 'GET',
    body,
    rpcUrl: upstreamRpcUrl(env),
    store: createVerifiedBurnStore(env, { fileRoot: root }),
  });
  sendJson(res, result.status, result.body);
}

async function handleBackfill(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  env: NodeJS.Dict<string>,
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  if (!authorizeBackfillRequest(req, (env.BURN_BACKFILL_SECRET || '').trim())) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  const rpcUrl = upstreamRpcUrl(env);
  if (!rpcUrl || rpcUrl.startsWith('/')) {
    sendJson(res, 503, { error: 'Solana RPC endpoint is not configured.' });
    return;
  }
  const store = createVerifiedBurnStore(env, { fileRoot: root });
  const result = await backfillSeedSignatures({ rpcUrl, store });
  sendJson(res, 200, {
    ok: true,
    mode: result.mode,
    persistence: store.persistence,
    verified: result.verified,
    inserted: result.inserted,
    alreadyIndexed: result.alreadyIndexed,
    failed: result.failed,
    records: result.records,
    failures: result.failures,
  });
}

/** @deprecated Use moginhoodApiPlugin — kept as a stable Vite config name. */
export const verifiedBurnsPlugin = moginhoodApiPlugin;
