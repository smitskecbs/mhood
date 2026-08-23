import { describe, expect, it } from 'vitest';
import type { BurnExecutionResult, PreparedBurn } from '../types';
import {
  canShowVerifiedBurnScene,
  staysOnAuthenticatedForest,
  toVerifiedBurnSuccess,
  verifiedBurnExplorerUrl,
} from './verifiedBurnScene';

const prepared: PreparedBurn = {
  mode: 'real',
  wallet: 'DemoWallet11111111111111111111111111',
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  decimals: 6,
  amountRaw: 2_000_000n,
  amountUi: '2',
  allocations: [],
  instructionCount: 1,
};

const verified: BurnExecutionResult = {
  mode: 'real',
  prepared,
  signature: '3zHkVerifiedBurnSignatureForTestsEzsH',
  verified: true,
  slot: 12,
  timestamp: 1_700_000_000,
};

describe('verified burn success scene', () => {
  it('opens only after a real on-chain verified burn', () => {
    expect(canShowVerifiedBurnScene(verified)).toBe(true);
    expect(toVerifiedBurnSuccess(verified)?.amountUi).toBe('2');
    expect(toVerifiedBurnSuccess(verified)?.signature).toBe(verified.signature);
  });

  it('does not open for simulation, rejection, failed confirmation, or verification failure', () => {
    expect(
      canShowVerifiedBurnScene({
        mode: 'simulation',
        prepared: { ...prepared, mode: 'simulation' },
        message: 'simulated',
      }),
    ).toBe(false);
    expect(canShowVerifiedBurnScene(null)).toBe(false);
    expect(canShowVerifiedBurnScene({ ...verified, signature: '' })).toBe(false);
    expect(toVerifiedBurnSuccess({ ...verified, mode: 'real', verified: true, signature: '' })).toBeNull();
  });

  it('builds a Solscan URL from the real signature', () => {
    expect(verifiedBurnExplorerUrl(verified.signature)).toBe(
      `https://solscan.io/tx/${verified.signature}`,
    );
    expect(verifiedBurnExplorerUrl(verified.signature, 'https://solscan.io/tx/')).toContain(
      verified.signature,
    );
  });

  it('returns to the authenticated Forest without restarting the gate', () => {
    expect(staysOnAuthenticatedForest('forest', 'granted')).toBe(true);
    expect(staysOnAuthenticatedForest('intro', 'granted')).toBe(false);
    expect(staysOnAuthenticatedForest('gate', 'granted')).toBe(false);
    expect(staysOnAuthenticatedForest('gateDwell', 'granted')).toBe(false);
    expect(staysOnAuthenticatedForest('forestEntry', 'granted')).toBe(false);
    expect(staysOnAuthenticatedForest('forest', 'disconnected')).toBe(false);
  });
});
