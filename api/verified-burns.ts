import { createVerifiedBurnStore } from '../server/createVerifiedBurnStore.js';
import { handleVerifiedBurnsRequest } from '../server/verifiedBurnsApi.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

function isWebRequest(value: unknown): value is Request {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Request).json === 'function' &&
      typeof (value as Request).arrayBuffer === 'function',
  );
}

type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
};

function storeFromEnv() {
  return createVerifiedBurnStore(process.env);
}

export async function GET(): Promise<Response> {
  const result = await handleVerifiedBurnsRequest({
    httpMethod: 'GET',
    body: null,
    rpcUrl: process.env.HELIUS_RPC_URL ?? '',
    store: storeFromEnv(),
  });
  return Response.json(result.body, { status: result.status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { verified: false, persistence: 'inactive', error: 'Invalid burn payload.' },
        { status: 400 },
      );
    }
    const result = await handleVerifiedBurnsRequest({
      httpMethod: 'POST',
      body,
      rpcUrl: process.env.HELIUS_RPC_URL ?? '',
      store: storeFromEnv(),
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Burn verification is temporarily unavailable.';
    return Response.json(
      { verified: false, persistence: 'inactive', error: message },
      { status: 200 },
    );
  }
}

export default async function handler(
  request: Request | { method?: string; body?: unknown },
  response?: NodeResponse,
): Promise<Response | void> {
  const method = isWebRequest(request) ? request.method : request.method ?? 'GET';
  if (isWebRequest(request)) {
    return method === 'POST' ? POST(request) : GET();
  }
  if (response && typeof response.end === 'function') {
    const result = await handleVerifiedBurnsRequest({
      httpMethod: method === 'POST' ? 'POST' : 'GET',
      body: method === 'POST' ? (request.body ?? null) : null,
      rpcUrl: process.env.HELIUS_RPC_URL ?? '',
      store: storeFromEnv(),
    });
    response.statusCode = result.status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result.body));
    return;
  }
  return GET();
}
