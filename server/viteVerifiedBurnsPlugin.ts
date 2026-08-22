import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Connection } from '@solana/web3.js';
import { loadEnv, type Plugin } from 'vite';
import {
  collectBurnCheckedInstructions,
  confirmAndVerifyBurn,
  upsertVerifiedBurn,
} from '../src/services/burnVerification';
import type { BurnRecord } from '../src/types';

const STORE_FILE = 'data/verified-burns.json';
const MINT = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';
const DECIMALS = 6;

function serverBurnLog(message: string): void {
  console.info(`[MoginHood server] ${message}`);
}

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function rpcUrlFromEnv(root: string, mode: string): string {
  const env = loadEnv(mode, root, '');
  return (env.VITE_SOLANA_RPC_URL ?? '').trim();
}

async function handlePost(
  root: string,
  mode: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const rpcUrl = rpcUrlFromEnv(root, mode);
  if (!rpcUrl) {
    serverBurnLog('verification failed: RPC not configured');
    sendJson(res, 503, { error: 'Solana RPC endpoint is not configured.' });
    return;
  }

  const body = await readBody(req);
  let signature = '';
  try {
    const parsed = JSON.parse(body) as { signature?: unknown };
    signature = typeof parsed.signature === 'string' ? parsed.signature.trim() : '';
  } catch {
    serverBurnLog('verification failed: invalid payload');
    sendJson(res, 400, { error: 'Invalid burn payload.' });
    return;
  }
  if (!signature) {
    serverBurnLog('verification failed: missing signature');
    sendJson(res, 400, { error: 'Missing transaction signature.' });
    return;
  }

  const existing = readStore(root);
  const duplicate = existing.find((record) => record.signature === signature);
  if (duplicate) {
    serverBurnLog(`duplicate signature ignored: ${signature}`);
    sendJson(res, 200, { record: duplicate, added: false });
    return;
  }

  serverBurnLog(`verifying burn: ${signature}`);
  const connection = new Connection(rpcUrl, 'confirmed');
  try {
    const parsedTx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!parsedTx) {
      serverBurnLog('verification failed: transaction not found');
      sendJson(res, 400, { error: 'The forest could not confirm the burn.' });
      return;
    }

    const burns = collectBurnCheckedInstructions({
      transaction: parsedTx.transaction,
      meta: parsedTx.meta,
    });
    if (burns.length === 0) {
      serverBurnLog('verification failed: no BurnChecked instruction');
      sendJson(res, 400, { error: 'Transaction does not contain a MHOOD BurnChecked instruction.' });
      return;
    }
    const amountRaw = burns.reduce((total, burn) => total + burn.amountRaw, 0n);
    const wallet = burns[0]?.wallet ?? '';

    const record = await confirmAndVerifyBurn(
      connection,
      signature,
      { mint: MINT, wallet, amountRaw },
      DECIMALS,
    );
    serverBurnLog('verification success');
    const next = upsertVerifiedBurn(existing, record);
    writeStore(root, next.records);
    serverBurnLog('record stored');
    sendJson(res, next.added ? 201 : 200, { record, added: next.added });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
    serverBurnLog(`verification failed: ${message}`);
    sendJson(res, 400, { error: message });
  }
}

export function verifiedBurnsPlugin(): Plugin {
  return {
    name: 'moginhood-verified-burns',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/verified-burns') {
          next();
          return;
        }

        const root = server.config.root;
        if (req.method === 'GET') {
          sendJson(res, 200, { records: readStore(root) });
          return;
        }
        if (req.method === 'POST') {
          void handlePost(root, server.config.mode, req, res).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
            serverBurnLog(`handler failed: ${message}`);
            sendJson(res, 500, { error: message });
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}
