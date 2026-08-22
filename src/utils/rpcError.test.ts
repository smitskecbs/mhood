import { describe, expect, it } from 'vitest';
import { COPY } from '../config/constants';
import { RPC_NOT_CONFIGURED } from '../config/env';
import { formatHolderRpcError, formatRpcError, redactRpcUrl } from './devLog';
import { resolveAccessStatus } from './access';
import {
  formatHolderVerificationError,
  HolderVerificationError,
  isTransportRpcError,
} from './holderVerificationError';

describe('RPC error handling', () => {
  it('maps a missing RPC to an explicit configuration error', () => {
    expect(formatHolderRpcError(new Error(RPC_NOT_CONFIGURED))).toEqual({
      title: 'Solana RPC endpoint is not configured.',
    });
  });

  it('maps network failures to RPC unavailable', () => {
    const err = Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' });
    expect(isTransportRpcError(err)).toBe(true);
    const view = formatHolderRpcError(err);
    expect(view.title).toBe(COPY.rpcUnavailable);
    expect(view.detail).toBe(COPY.rpcUnavailableDetail);
  });

  it('maps proxy 5xx to RPC unavailable', () => {
    const err = new HolderVerificationError({
      stage: 'token-accounts',
      method: 'getTokenAccountsByOwner',
      message: 'RPC proxy HTTP 502',
      transport: true,
    });
    expect(formatHolderVerificationError(err).detail).toBe(COPY.rpcUnavailableDetail);
  });

  it('does not map parsing or mint errors to RPC unavailable', () => {
    const parseErr = new Error('Could not parse token account amount');
    const view = formatHolderRpcError(parseErr);
    expect(view.title).toBe(COPY.holderVerifyFailed);
    expect(view.detail).toBeUndefined();
    expect(isTransportRpcError(parseErr)).toBe(false);

    const mintErr = new HolderVerificationError({
      stage: 'mint-read',
      method: 'getAccountInfo',
      message: 'Mint account data is not base64',
    });
    expect(formatHolderRpcError(mintErr).title).toBe(COPY.holderVerifyFailed);
    expect(formatHolderRpcError(mintErr).detail).not.toBe(COPY.rpcUnavailableDetail);
  });

  it('does not map HTTP 403 application errors to RPC unavailable', () => {
    const view = formatHolderRpcError(new Error('403 Forbidden'));
    expect(view.title).toBe(COPY.holderVerifyFailed);
    expect(view.detail).not.toBe(COPY.rpcUnavailableDetail);
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
