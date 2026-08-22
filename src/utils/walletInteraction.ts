import type { AccessStatus } from '../types';

export function isWalletUiInteractive(visible: boolean): boolean {
  return visible;
}

export function signButtonEnabled(input: {
  connected: boolean;
  hasPublicKey: boolean;
  canSign: boolean;
  signing: boolean;
  status: AccessStatus;
}): boolean {
  if (input.signing) return false;
  if (!input.connected || !input.hasPublicKey || !input.canSign) return false;
  if (
    input.status === 'checking' ||
    input.status === 'granted' ||
    input.status === 'insufficient' ||
    input.status === 'error'
  ) {
    return false;
  }
  return true;
}

export function shouldStartSingleHolderVerification(input: {
  wallet: string | null;
  authenticated: boolean;
  alreadyStartedFor: string | null;
}): boolean {
  if (!input.authenticated || !input.wallet) return false;
  return input.alreadyStartedFor !== input.wallet;
}

let activeHolderVerificationWallet: string | null = null;

export function claimHolderVerification(wallet: string): boolean {
  if (activeHolderVerificationWallet === wallet) return false;
  activeHolderVerificationWallet = wallet;
  return true;
}

export function resetHolderVerification(wallet?: string | null): void {
  if (wallet == null || activeHolderVerificationWallet === wallet) {
    activeHolderVerificationWallet = null;
  }
}
