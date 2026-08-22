import { handleJsonRpcProxy, jsonRpcHttpResponse, rpcProxyFromRequest } from '../server/rpcProxy.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

export async function POST(request: Request): Promise<Response> {
  return rpcProxyFromRequest(request, process.env);
}

export async function GET(): Promise<Response> {
  return jsonRpcHttpResponse(405, { error: 'Method not allowed' });
}

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

export default async function handler(
  request: Request | { method?: string; body?: unknown },
  response?: NodeResponse,
): Promise<Response | void> {
  if (isWebRequest(request)) {
    return request.method === 'POST' ? POST(request) : GET();
  }
  if (response && typeof response.end === 'function') {
    const result = await handleJsonRpcProxy({
      httpMethod: request.method ?? 'GET',
      body: request.method === 'POST' ? (request.body ?? null) : null,
      upstreamUrl: process.env.HELIUS_RPC_URL,
    });
    response.statusCode = result.status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result.body));
    return;
  }
  return jsonRpcHttpResponse(500, { error: 'Unsupported RPC runtime.' });
}
