import { describe, expect, it } from 'vitest';
import {
  buildWalletMhoodBalance,
  collectTokenAccountsFromParsed,
  parseTokenAmountRaw,
  thresholdRawFromMint,
} from './mhoodBalanceService';
import type { MintDetails } from '../types';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1_000_000_000_000_000n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

describe('token account parsing', () => {
  it('parses RPC integer strings as bigint and never uses uiAmount floats', () => {
    expect(parseTokenAmountRaw('1000000000000')).toBe(1_000_000_000_000n);
    expect(() => parseTokenAmountRaw(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/i);
  });

  it('sums every MHOOD token account for the owner', () => {
    const accounts = collectTokenAccountsFromParsed(
      [
        {
          pubkey: 'account-a',
          account: {
            data: {
              parsed: {
                info: {
                  mint: mint.mint,
                  tokenAmount: { amount: '700000000000' },
                },
              },
            },
          },
        },
        {
          pubkey: 'account-b',
          account: {
            data: {
              parsed: {
                info: {
                  mint: mint.mint,
                  tokenAmount: { amount: '300000000000' },
                },
              },
            },
          },
        },
      ],
      mint.mint,
    );

    const snapshot = buildWalletMhoodBalance({
      wallet: 'OwnerWallet',
      mint,
      accounts,
    });

    expect(accounts).toHaveLength(2);
    expect(snapshot.totalRaw).toBe(1_000_000_000_000n);
    expect(snapshot.meetsAccessThreshold).toBe(true);
    expect(thresholdRawFromMint(mint)).toBe(1_000_000_000_000n);
  });

  it('does not grant access when the combined accounts stay under 1M', () => {
    const accounts = collectTokenAccountsFromParsed(
      [
        {
          pubkey: 'account-a',
          account: {
            data: { parsed: { info: { mint: mint.mint, tokenAmount: { amount: '500000000000' } } } },
          },
        },
        {
          pubkey: 'account-b',
          account: {
            data: { parsed: { info: { mint: mint.mint, tokenAmount: { amount: '499999999999' } } } },
          },
        },
      ],
      mint.mint,
    );
    const snapshot = buildWalletMhoodBalance({ wallet: 'OwnerWallet', mint, accounts });
    expect(snapshot.totalRaw).toBe(999_999_999_999n);
    expect(snapshot.meetsAccessThreshold).toBe(false);
  });
});
