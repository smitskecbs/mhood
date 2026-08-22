import type { AccessStatus } from '../types';

export type HolderGateResult = 'PASS' | 'FAIL';

export function evaluateHolderGate(totalRaw: bigint, thresholdRaw: bigint): HolderGateResult {
  return totalRaw >= thresholdRaw ? 'PASS' : 'FAIL';
}

export function accessAfterWalletChange(
  previousWallet: string | null,
  nextWallet: string | null,
): { wallet: string | null; status: AccessStatus; clearBalance: boolean; clearAuth: boolean } {
  if (!nextWallet) {
    return { wallet: null, status: 'disconnected', clearBalance: true, clearAuth: true };
  }
  if (previousWallet !== nextWallet) {
    return { wallet: nextWallet, status: 'awaiting_signature', clearBalance: true, clearAuth: true };
  }
  return { wallet: nextWallet, status: 'awaiting_signature', clearBalance: false, clearAuth: false };
}

export function resolveAccessStatus(input: {
  connected: boolean;
  authenticated: boolean;
  checking: boolean;
  error: string | null;
  meetsThreshold: boolean | null;
}): AccessStatus {
  if (!input.connected) return 'disconnected';
  if (!input.authenticated) return 'awaiting_signature';
  if (input.meetsThreshold === true) return 'granted';
  if (input.checking) return 'checking';
  if (input.error) return 'error';
  if (input.meetsThreshold === false) return 'insufficient';
  return 'checking';
}

export function shouldShowForest(status: AccessStatus): boolean {
  return status === 'granted';
}
