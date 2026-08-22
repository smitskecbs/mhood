import { describe, expect, it } from 'vitest';
import { claimHolderVerification, isWalletUiInteractive, resetHolderVerification, shouldStartSingleHolderVerification, signButtonEnabled } from './walletInteraction';

describe('wallet UI interaction', () => {
  it('is interactive at the same moment it becomes visible', () => {
    expect(isWalletUiInteractive(false)).toBe(false);
    expect(isWalletUiInteractive(true)).toBe(true);
  });

  it('enables Sign to enter from wallet state, not animations or ranking data', () => {
    expect(
      signButtonEnabled({
        connected: true,
        hasPublicKey: true,
        canSign: true,
        signing: false,
        status: 'awaiting_signature',
      }),
    ).toBe(true);
    expect(
      signButtonEnabled({
        connected: true,
        hasPublicKey: true,
        canSign: true,
        signing: true,
        status: 'awaiting_signature',
      }),
    ).toBe(false);
  });

  it('starts holder verification once per authenticated wallet', () => {
    expect(
      shouldStartSingleHolderVerification({
        wallet: 'WalletA',
        authenticated: true,
        alreadyStartedFor: null,
      }),
    ).toBe(true);
    expect(
      shouldStartSingleHolderVerification({
        wallet: 'WalletA',
        authenticated: true,
        alreadyStartedFor: 'WalletA',
      }),
    ).toBe(false);
  });

  it('claims only one holder-verification flow per wallet', () => {
    resetHolderVerification();
    expect(claimHolderVerification('WalletA')).toBe(true);
    expect(claimHolderVerification('WalletA')).toBe(false);
    resetHolderVerification('WalletA');
    expect(claimHolderVerification('WalletA')).toBe(true);
    resetHolderVerification();
  });
});
