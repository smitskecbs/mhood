import { explorerTxUrl } from './format';
import type { AccessStatus, BurnExecutionResult, BurnPersistenceMode, ForestScene } from '../types';

export type VerifiedBurnSuccess = {
  signature: string;
  amountUi: string;
  wallet: string;
  persistence?: BurnPersistenceMode;
};

export function canShowVerifiedBurnScene(
  result: BurnExecutionResult | null | undefined,
): result is Extract<BurnExecutionResult, { mode: 'real' }> {
  return Boolean(
    result &&
      result.mode === 'real' &&
      result.verified === true &&
      typeof result.signature === 'string' &&
      result.signature.length > 0,
  );
}

export function toVerifiedBurnSuccess(result: BurnExecutionResult | null | undefined): VerifiedBurnSuccess | null {
  if (!canShowVerifiedBurnScene(result)) return null;
  return {
    signature: result.signature,
    amountUi: result.prepared.amountUi,
    wallet: result.prepared.wallet,
    persistence: result.persistence,
  };
}

export function verifiedBurnExplorerUrl(signature: string, base = 'https://solscan.io/tx/'): string {
  return explorerTxUrl(base, signature);
}

export function staysOnAuthenticatedForest(scene: ForestScene, status: AccessStatus): boolean {
  return scene === 'forest' && status === 'granted';
}
