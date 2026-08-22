import { describe, expect, it, vi } from 'vitest';
import { COPY } from '../config/constants';
import { formatHolderRpcError } from '../utils/devLog';
import {
  HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
  HolderVerificationError,
} from '../utils/holderVerificationError';
import {
  buildWalletMhoodBalance,
  collectTokenAccountsFromParsed,
  fetchWalletMhoodBalance,
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

  it('reads a transparent proxy getTokenAccountsByOwner jsonParsed value for 19,811,049 MHOOD', () => {
    const wallet = 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY';
    const accounts = collectTokenAccountsFromParsed(
      [
        {
          pubkey: '8NhytvfwpsJWDSr39CBuXuqT7pCrjmuXX2zZzSEWb5Nj',
          account: {
            data: {
              parsed: {
                info: {
                  mint: mint.mint,
                  owner: wallet,
                  state: 'initialized',
                  tokenAmount: {
                    amount: '19811049000000',
                    decimals: 6,
                    uiAmount: 19811049,
                    uiAmountString: '19811049',
                  },
                },
              },
            },
          },
        },
      ],
      mint.mint,
      wallet,
    );
    const snapshot = buildWalletMhoodBalance({ wallet, mint, accounts });
    expect(accounts[0]?.amountRaw).toBe(19_811_049_000_000n);
    expect(snapshot.totalRaw).toBe(19_811_049_000_000n);
    expect(snapshot.meetsAccessThreshold).toBe(true);
  });

  it('reports token-account parse failures as a parse stage, not RPC unavailable', () => {
    expect(() =>
      collectTokenAccountsFromParsed(
        [
          {
            pubkey: 'account-a',
            account: { data: { parsed: { info: { mint: mint.mint } } } },
          },
        ],
        mint.mint,
      ),
    ).toThrow(/parse token account amount/i);

    const err = HolderVerificationError.from(
      new Error('Could not parse token account amount'),
      'balance-parse',
      HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
    );
    expect(err.stage).toBe('balance-parse');
    expect(formatHolderRpcError(err).title).toBe(COPY.holderVerifyFailed);
    expect(formatHolderRpcError(err).detail).not.toBe(COPY.rpcUnavailableDetail);
  });

  it('fetches balances from result.value of getTokenAccountsByOwner', async () => {
    const wallet = 'memekrM9YqzBQBmHjgne8CHeaPicxwFDxeMo3bkHwMY';
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          context: { slot: 1 },
          value: [
            {
              pubkey: '8NhytvfwpsJWDSr39CBuXuqT7pCrjmuXX2zZzSEWb5Nj',
              account: {
                data: {
                  program: 'spl-token',
                  parsed: {
                    info: {
                      mint: mint.mint,
                      owner: wallet,
                      state: 'initialized',
                      tokenAmount: { amount: '19811049000000', decimals: 6 },
                    },
                    type: 'account',
                  },
                  space: 165,
                },
                owner: mint.tokenProgramId,
                lamports: 2039280,
                executable: false,
                rentEpoch: 18446744073709552000,
              },
            },
          ],
        },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    try {
      const snapshot = await fetchWalletMhoodBalance(wallet, { mintDetails: mint });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [, init] = fetchImpl.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(init.body) as { method: string; params: unknown[] };
      expect(body.method).toBe(HOLDER_TOKEN_ACCOUNTS_RPC_METHOD);
      expect(body.params[2]).toMatchObject({ encoding: 'jsonParsed' });
      expect(snapshot.totalRaw).toBe(19_811_049_000_000n);
      expect(snapshot.meetsAccessThreshold).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
