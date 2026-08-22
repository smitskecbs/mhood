export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const INACTIVE_GET_BODY = { records: [] as const, persistence: 'inactive' as const };

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

export async function GET(): Promise<Response> {
  console.info('[MoginHood] burn persistence: inactive');
  return Response.json(INACTIVE_GET_BODY);
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
    const { handleVerifiedBurnsRequest } = await import('../server/verifiedBurnsApi.js');
    const result = await handleVerifiedBurnsRequest({
      httpMethod: 'POST',
      body,
      persistence: 'inactive',
      records: [],
      rpcUrl: process.env.HELIUS_RPC_URL ?? '',
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    console.info('[MoginHood] burn persistence: inactive');
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
    if (method !== 'POST') {
      console.info('[MoginHood] burn persistence: inactive');
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(INACTIVE_GET_BODY));
      return;
    }
    try {
      const { handleVerifiedBurnsRequest } = await import('../server/verifiedBurnsApi.js');
      const result = await handleVerifiedBurnsRequest({
        httpMethod: 'POST',
        body: request.body ?? null,
        persistence: 'inactive',
        records: [],
        rpcUrl: process.env.HELIUS_RPC_URL ?? '',
      });
      response.statusCode = result.status;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(result.body));
    } catch (err) {
      console.info('[MoginHood] burn persistence: inactive');
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          verified: false,
          persistence: 'inactive',
          error: err instanceof Error ? err.message : 'Burn verification is temporarily unavailable.',
        }),
      );
    }
    return;
  }
  return GET();
}
