import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import type { BurnRecord } from '../src/types/index.js';
import { readJsonBody, sendJson } from './httpJson.js';
import { handleJsonRpcProxy } from './rpcProxy.js';
import { handleVerifiedBurnsRequest } from './verifiedBurnsApi.js';

const STORE_FILE = 'data/verified-burns.json';

type StoreFile = { records: BurnRecord[] };

function storePath(root: string): string {
  return path.join(root, STORE_FILE);
}

function readStore(root: string): BurnRecord[] {
  try {
    const raw = fs.readFileSync(storePath(root), 'utf8');
    const parsed = JSON.parse(raw) as StoreFile;
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function writeStore(root: string, records: BurnRecord[]): void {
  const file = storePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ records }, null, 2)}\n`, 'utf8');
}

function serverRpcUrl(root: string, mode: string): string {
  const env = loadEnv(mode, root, '');
  return (env.HELIUS_RPC_URL || env.VITE_SOLANA_RPC_URL || '').trim();
}

export function moginhoodApiPlugin(): Plugin {
  return {
    name: 'moginhood-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        const root = server.config.root;
        const mode = server.config.mode;

        if (url === '/api/rpc') {
          void handleRpc(req, res, root, mode).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Invalid JSON-RPC request.';
            sendJson(res, 400, { error: message });
          });
          return;
        }

        if (url === '/api/verified-burns') {
          void handleBurns(req, res, root, mode).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
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
  root: string,
  mode: string,
): Promise<void> {
  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  const result = await handleJsonRpcProxy({
    httpMethod: req.method ?? 'GET',
    body,
    upstreamUrl: serverRpcUrl(root, mode),
  });
  sendJson(res, result.status, result.body);
}

async function handleBurns(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  mode: string,
): Promise<void> {
  const body = req.method === 'POST' ? await readJsonBody(req) : null;
  const result = await handleVerifiedBurnsRequest({
    httpMethod: req.method ?? 'GET',
    body,
    persistence: 'local',
    records: readStore(root),
    rpcUrl: serverRpcUrl(root, mode),
    persist: (record) => {
      const next = [...readStore(root).filter((item) => item.signature !== record.signature), record];
      writeStore(root, next);
      return next;
    },
  });
  sendJson(res, result.status, result.body);
}

/** @deprecated Use moginhoodApiPlugin — kept as a stable Vite config name. */
export const verifiedBurnsPlugin = moginhoodApiPlugin;
