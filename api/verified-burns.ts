import { handleVerifiedBurnsRequest } from '../server/verifiedBurnsApi';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

async function verifiedBurnsFromRequest(request: Request): Promise<Response> {
  let body: unknown = null;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid burn payload.' }, { status: 400 });
    }
  }
  const result = await handleVerifiedBurnsRequest({
    httpMethod: request.method,
    body,
    persistence: 'inactive',
    records: [],
    rpcUrl: process.env.HELIUS_RPC_URL ?? '',
  });
  return Response.json(result.body, { status: result.status });
}

export async function GET(request: Request): Promise<Response> {
  return verifiedBurnsFromRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return verifiedBurnsFromRequest(request);
}
