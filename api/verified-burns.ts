import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, sendJson } from '../server/httpJson';
import { handleVerifiedBurnsRequest } from '../server/verifiedBurnsApi';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = req.method === 'POST' ? await readJsonBody(req) : null;
    const result = await handleVerifiedBurnsRequest({
      httpMethod: req.method ?? 'GET',
      body,
      persistence: 'inactive',
      records: [],
      rpcUrl: process.env.HELIUS_RPC_URL ?? '',
    });
    sendJson(res, result.status, result.body);
  } catch {
    sendJson(res, 400, { error: 'Invalid burn payload.' });
  }
}
