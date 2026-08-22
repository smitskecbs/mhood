import { backfillVerifiedBurns } from '../../server/backfillVerifiedBurns.js';
import { createVerifiedBurnStore } from '../../server/createVerifiedBurnStore.js';
import { authorizeBackfillRequest } from '../../server/verifiedBurnsApi.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export async function POST(request: Request): Promise<Response> {
  if (!authorizeBackfillRequest(request)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const rpcUrl = (process.env.HELIUS_RPC_URL ?? '').trim();
  if (!rpcUrl) {
    return Response.json({ error: 'Solana RPC endpoint is not configured.' }, { status: 503 });
  }
  const store = createVerifiedBurnStore(process.env);
  if (store.persistence === 'inactive') {
    return Response.json(
      { error: 'Persistent burn storage is not configured.' },
      { status: 503 },
    );
  }
  const result = await backfillVerifiedBurns({ rpcUrl, store });
  return Response.json({
    ok: true,
    persistence: store.persistence,
    scanned: result.scanned,
    imported: result.imported.length,
    duplicates: result.duplicates.length,
    rejected: result.rejected.length,
    records: result.imported,
  });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export default async function handler(request: Request): Promise<Response> {
  return request.method === 'POST' ? POST(request) : GET();
}
