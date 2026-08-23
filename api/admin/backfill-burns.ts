import { handleAdminBackfillRequest } from '../../server/adminBackfill.js';

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

export async function POST(request: Request): Promise<Response> {
  console.log('[MoginHood backfill] request start');
  try {
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: request.headers,
      request,
      env: process.env,
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backfill failed';
    return Response.json({ ok: false, stage: 'unexpected', error: message }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export default async function handler(
  request: Request | { method?: string; headers?: IncomingHeaders; body?: unknown },
  response?: NodeResponse,
): Promise<Response | void> {
  if (isWebRequest(request)) {
    return request.method === 'POST' ? POST(request) : GET();
  }
  console.log('[MoginHood backfill] request start');
  if (response && typeof response.end === 'function') {
    const result = await handleAdminBackfillRequest({
      httpMethod: request.method === 'POST' ? 'POST' : 'GET',
      headers: request.headers,
      body: null,
      env: process.env,
    });
    response.statusCode = result.status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result.body));
    return;
  }
  return GET();
}

type IncomingHeaders = Headers | Record<string, string | string[] | undefined>;
