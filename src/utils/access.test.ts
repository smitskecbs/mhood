import { describe, expect, it } from 'vitest';
import { accessAfterWalletChange, evaluateHolderGate, resolveAccessStatus, shouldShowForest } from './access';
import { uiAmountToRaw } from './tokenAmount';
import { isDevBypassGateEnabled, parseRealBurnFlag } from '../config/env';

const DECIMALS = 6;
const THRESHOLD = uiAmountToRaw('1000000', DECIMALS);

describe('access state', () => {
  it('stays disconnected until a wallet is connected', () => {
    expect(
      resolveAccessStatus({
        connected: false,
        authenticated: false,
        checking: false,
        error: null,
        meetsThreshold: null,
      }),
    ).toBe('disconnected');
    expect(shouldShowForest('disconnected')).toBe(false);
  });

  it('does not grant Forest access from connect alone', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: false,
        checking: false,
        error: null,
        meetsThreshold: true,
      }),
    ).toBe('awaiting_signature');
    expect(shouldShowForest('awaiting_signature')).toBe(false);
  });

  it('shows checking for an authenticated wallet before the RPC result arrives', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: true,
        error: null,
        meetsThreshold: null,
      }),
    ).toBe('checking');
  });

  it('keeps forest access during a background refresh', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: true,
        error: null,
        meetsThreshold: true,
      }),
    ).toBe('granted');
  });

  it('returns error when the RPC call fails and no passing balance is cached', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: false,
        error: '429 too many requests',
        meetsThreshold: null,
      }),
    ).toBe('error');
  });

  it('keeps the wallet connected when RPC verification fails', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: false,
        error: 'The forest cannot verify your MHOOD right now.',
        meetsThreshold: null,
      }),
    ).toBe('error');
    expect(accessAfterWalletChange('WalletA', 'WalletA')).toEqual({
      wallet: 'WalletA',
      status: 'awaiting_signature',
      clearBalance: false,
      clearAuth: false,
    });
  });

  it('hides the forest unless access is granted', () => {
    expect(shouldShowForest('granted')).toBe(true);
    expect(shouldShowForest('insufficient')).toBe(false);
    expect(shouldShowForest('error')).toBe(false);
    expect(shouldShowForest('awaiting_signature')).toBe(false);
  });
});

describe('holder gate after signature', () => {
  it('denies a verified wallet below 1,000,000 MHOOD', () => {
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: false,
        error: null,
        meetsThreshold: false,
      }),
    ).toBe('insufficient');
    expect(evaluateHolderGate(uiAmountToRaw('999999.999999', DECIMALS), THRESHOLD)).toBe('FAIL');
  });

  it('grants a verified wallet at or above 1,000,000 MHOOD', () => {
    expect(THRESHOLD).toBe(1_000_000_000_000n);
    expect(evaluateHolderGate(uiAmountToRaw('1000000', DECIMALS), THRESHOLD)).toBe('PASS');
    expect(
      resolveAccessStatus({
        connected: true,
        authenticated: true,
        checking: false,
        error: null,
        meetsThreshold: true,
      }),
    ).toBe('granted');
  });

  it('fails 0 MHOOD', () => {
    expect(evaluateHolderGate(0n, THRESHOLD)).toBe('FAIL');
  });

  it('passes more than 1,000,000 MHOOD', () => {
    expect(evaluateHolderGate(uiAmountToRaw('1000000.000001', DECIMALS), THRESHOLD)).toBe('PASS');
    expect(evaluateHolderGate(uiAmountToRaw('4820000', DECIMALS), THRESHOLD)).toBe('PASS');
  });
});

describe('wallet identity changes', () => {
  it('clears access and authentication on disconnect', () => {
    expect(accessAfterWalletChange('WalletA', null)).toEqual({
      wallet: null,
      status: 'disconnected',
      clearBalance: true,
      clearAuth: true,
    });
  });

  it('clears the previous wallet balance and authentication on account switch', () => {
    expect(accessAfterWalletChange('WalletA', 'WalletB')).toEqual({
      wallet: 'WalletB',
      status: 'awaiting_signature',
      clearBalance: true,
      clearAuth: true,
    });
  });
});

describe('safety flags', () => {
  it('keeps real burns disabled unless the env flag is the string true', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(parseRealBurnFlag('false')).toBe(false);
    expect(parseRealBurnFlag('true')).toBe(true);
  });

  it('keeps the holder-gate bypass disabled by default', () => {
    expect(isDevBypassGateEnabled()).toBe(false);
  });
});
