import { describe, expect, it, vi } from 'vitest';
import { COPY } from '../../config/constants';
import {
  HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
  HolderVerificationError,
  formatHolderVerificationError,
} from '../../utils/holderVerificationError';
import { postJsonRpc, unwrapJsonRpcPayload, unwrapRpcContextValue } from './jsonRpc';

describe('JSON-RPC proxy unwrapping', () => {
  it('unwraps a transparent JSON-RPC body once', () => {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      result: { context: { slot: 1, apiVersion: '4.3.0-alpha.2' }, value: 'ok' },
    };
    const result = unwrapJsonRpcPayload(payload);
    expect(result).toEqual({ context: { slot: 1, apiVersion: '4.3.0-alpha.2' }, value: 'ok' });
    expect(unwrapRpcContextValue(result, 'mint-read', 'getAccountInfo')).toBe('ok');
    expect((result as { result?: unknown }).result).toBeUndefined();
  });

  it('maps fetch network failures to a transport error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }));
    await expect(
      postJsonRpc({
        method: 'getHealth',
        params: [],
        stage: 'connection-init',
        rpcUrl: 'https://mhood.cbs-coin.com/api/rpc',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ stage: 'connection-init', transport: true, name: 'HolderVerificationError' });
  });

  it('maps HTTP 502 proxy responses to a transport error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 502,
      json: async () => ({ error: 'RPC upstream request failed.' }),
    });
    try {
      await postJsonRpc({
        method: HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
        params: [],
        stage: 'token-accounts',
        rpcUrl: 'https://mhood.cbs-coin.com/api/rpc',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(HolderVerificationError);
      expect((err as HolderVerificationError).transport).toBe(true);
      expect(formatHolderVerificationError(err).detail).toBe(COPY.rpcUnavailableDetail);
    }
  });
});
