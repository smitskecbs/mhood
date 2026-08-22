import { describe, expect, it } from 'vitest';
import { PROJECT_WALLETS, findProjectWallet, isProjectWallet } from './projectWallets';

describe('project wallets', () => {
  it('keeps known tokenomics wallets in one config', () => {
    expect(PROJECT_WALLETS.treasury.label).toBe('Treasury');
    expect(PROJECT_WALLETS.tokenLock.label).toBe('15% Token Lock');
    expect(PROJECT_WALLETS.dev.label).toBe('Dev Wallet');
    expect(PROJECT_WALLETS.presale.label).toBe('Presale Site');
    expect(PROJECT_WALLETS.presale.address).toBe('FwrAHTKGRptE6JKw53Cagcz5i45FeRq6fCfUAKmyrZhb');
    expect(isProjectWallet(PROJECT_WALLETS.treasury.address)).toBe(true);
    expect(isProjectWallet('CommunityWallet111111111111111111111111')).toBe(false);
    expect(findProjectWallet(PROJECT_WALLETS.dev.address)?.id).toBe('dev');
  });
});
