import { describe, expect, it, vi } from 'vitest';
import { handleJsonRpcProxy, isRpcMethodAllowed, rpcProxyFromRequest, sanitizeRpcLogText } from './rpcProxy';

const UPSTREAM = 'https://mainnet.helius-rpc.com/?api-key=super-secret-test-key';

describe('RPC proxy allowlist', () => {
  it('allows the methods this forest uses and blocks others', () => {
    expect(isRpcMethodAllowed('getAccountInfo')).toBe(true);
    expect(isRpcMethodAllowed('getTokenAccountsByOwner')).toBe(true);
    expect(isRpcMethodAllowed('getTokenAccounts')).toBe(true);
    expect(isRpcMethodAllowed('getLatestBlockhash')).toBe(true);
    expect(isRpcMethodAllowed('sendTransaction')).toBe(true);
    expect(isRpcMethodAllowed('getSignatureStatuses')).toBe(true);
    expect(isRpcMethodAllowed('getTransaction')).toBe(true);
    expect(isRpcMethodAllowed('simulateTransaction')).toBe(true);
    expect(isRpcMethodAllowed('getHealth')).toBe(true);
    expect(isRpcMethodAllowed('getVersion')).toBe(true);
    expect(isRpcMethodAllowed('getProgramAccounts')).toBe(false);
    expect(isRpcMethodAllowed('requestAirdrop')).toBe(false);
  });

  it('forwards an allowed method to Helius without exposing the key in logs', async () => {
    const logs: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(UPSTREAM);
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
      const body = JSON.parse(String(init?.body)) as { method: string };
      expect(body.method).toBe('getAccountInfo');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: null } }), {
        status: 200,
      });
    });

    const result = await handleJsonRpcProxy({
      httpMethod: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [] },
      upstreamUrl: UPSTREAM,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (message) => logs.push(message),
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ jsonrpc: '2.0', id: 1, result: { value: null } });
    expect(logs.join('\n')).toContain('[MoginHood RPC] method: getAccountInfo');
    expect(logs.join('\n')).toContain('[MoginHood RPC] upstream status: 200');
    expect(logs.join('\n')).not.toContain('super-secret-test-key');
    expect(logs.join('\n')).not.toContain('api-key=');
  });

  it('blocks a disallowed method with HTTP 403', async () => {
    const fetchImpl = vi.fn();
    const result = await handleJsonRpcProxy({
      httpMethod: 'POST',
      body: { jsonrpc: '2.0', id: 7, method: 'getProgramAccounts', params: [] },
      upstreamUrl: UPSTREAM,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32601, message: 'Method not allowed' },
    });
  });

  it('returns 500 when HELIUS_RPC_URL is missing', async () => {
    const logs: string[] = [];
    const result = await handleJsonRpcProxy({
      httpMethod: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [] },
      upstreamUrl: '',
      log: (message) => logs.push(message),
    });
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: 'RPC upstream is not configured.' });
    expect(logs.join('\n')).toContain('[MoginHood RPC] HELIUS_RPC_URL missing');
    expect(logs.join('\n')).not.toContain('api-key');
  });

  it('handles upstream errors without leaking the key', async () => {
    const logs: string[] = [];
    const result = await handleJsonRpcProxy({
      httpMethod: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [] },
      upstreamUrl: UPSTREAM,
      fetchImpl: (async () => {
        throw new Error(`Failed to fetch ${UPSTREAM}`);
      }) as unknown as typeof fetch,
      log: (message) => logs.push(message),
    });
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: 'RPC upstream request failed.' });
    expect(JSON.stringify(result.body)).not.toContain('super-secret-test-key');
    expect(logs.join('\n')).not.toContain('super-secret-test-key');
    expect(sanitizeRpcLogText(`boom ${UPSTREAM}`)).not.toContain('super-secret-test-key');
  });
});

describe('RPC proxy Web handler', () => {
  it('returns upstream JSON-RPC transparently for getHealth', async () => {
    const upstream = { jsonrpc: '2.0', id: 1, result: 'ok' };
    const response = await rpcProxyFromRequest(
      new Request('https://mhood.cbs-coin.com/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      }),
      { HELIUS_RPC_URL: UPSTREAM },
      (async () => new Response(JSON.stringify(upstream), { status: 200 })) as unknown as typeof fetch,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual(upstream);
  });
});
