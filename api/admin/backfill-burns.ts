import { handleAdminBackfillRequest } from '../../server/adminBackfill.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const result = await handleAdminBackfillRequest({
    httpMethod: 'POST',
    headers: request.headers,
    body: await readJsonBody(request),
    env: process.env,
  });
  return Response.json(result.body, { status: result.status });
}

export async function GET(): Promise<Response> {
  const result = await handleAdminBackfillRequest({
    httpMethod: 'GET',
    env: process.env,
  });
  return Response.json(result.body, { status: result.status });
}

export default async function handler(request: Request): Promise<Response> {
  return request.method === 'POST' ? POST(request) : GET();
}
