import { describe, expect, it } from 'vitest';
import { formatHolderRpcError, formatRpcError, redactRpcUrl } from './devLog';
import { RPC_NOT_CONFIGURED } from '../config/env';
import { resolveAccessStatus } from './access';

describe('RPC error handling', () => {
  it('maps a missing RPC to an explicit configuration error', () => {
    expect(formatHolderRpcError(new Error(RPC_NOT_CONFIGURED))).toEqual({
      title: 'Solana RPC endpoint is not configured.',
    });
  });

  it('maps HTTP 403 to a gate error without asking to reconnect', () => {
    const view = formatHolderRpcError(new Error('403 Forbidden'));
    expect(view.title).toBe('The forest cannot verify your MHOOD right now.');
    expect(view.detail).toBe('RPC connection unavailable.');
    expect(formatRpcError(new Error('403 Forbidden'))).toMatch(/403/);
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: false,
        error: view.title,
        meetsThreshold: null,
      }),
    ).toBe('error');
  });

  it('redacts query secrets from RPC URLs in logs', () => {
    expect(redactRpcUrl('https://rpc.example.com/solana?api-key=super-secret')).toBe(
      'https://rpc.example.com/solana',
    );
    expect(redactRpcUrl('/api/rpc')).toBe('/api/rpc');
  });
});
