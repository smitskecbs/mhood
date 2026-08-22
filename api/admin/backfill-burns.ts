import { handleAdminBackfillRequest } from '../../server/adminBackfill.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export async function POST(request: Request): Promise<Response> {
  const result = await handleAdminBackfillRequest({
    httpMethod: 'POST',
    headers: request.headers,
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
