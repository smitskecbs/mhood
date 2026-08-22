import type { Connection } from '@solana/web3.js';
import type { MintDetails, TokenAccountBalance, WalletMhoodBalance } from '../types';
import { appConfig, isDevBypassGateEnabled, requireConfiguredRpcUrl } from '../config/env';
import { uiAmountToRaw } from '../utils/tokenAmount';
import { evaluateHolderGate } from '../utils/access';
import { sumTokenAccounts } from '../utils/accounts';
import {
  HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
  HolderVerificationError,
} from '../utils/holderVerificationError';
import { fetchMintDetails } from './solana/mintService';
import { postJsonRpc, unwrapRpcContextValue, type JsonRpcContextResult } from './solana/jsonRpc';

export function thresholdRawFromMint(mint: MintDetails, thresholdUi = appConfig.accessThresholdUi): bigint {
  return uiAmountToRaw(thresholdUi, mint.decimals);
}

export function parseTokenAmountRaw(value: unknown): bigint {
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) {
      throw new Error(`Token amount is not an integer string: ${value}`);
    }
    return BigInt(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Token amount must be a safe integer string from RPC, not a JS number');
    }
    return BigInt(value);
  }
  throw new Error('Could not parse token account amount');
}

export type ParsedTokenAccountResponse = {
  pubkey: { toBase58(): string } | string;
  account: {
    data: {
      parsed?: {
        info?: {
          mint?: string;
          owner?: string;
          state?: string;
          tokenAmount?: {
            amount?: string | number;
            decimals?: number;
            uiAmount?: number | null;
            uiAmountString?: string;
          };
        };
      };
    };
  };
};

export function collectTokenAccountsFromParsed(
  entries: ParsedTokenAccountResponse[],
  expectedMint: string,
  expectedOwner?: string,
): TokenAccountBalance[] {
  return entries.map((entry) => {
    const info = entry.account.data.parsed?.info;
    if (info?.mint && info.mint !== expectedMint) {
      throw new Error(`Token account mint mismatch: ${info.mint}`);
    }
    if (expectedOwner && info?.owner && info.owner !== expectedOwner) {
      throw new Error(`Token account owner mismatch: ${info.owner}`);
    }
    const address = typeof entry.pubkey === 'string' ? entry.pubkey : entry.pubkey.toBase58();
    const amountRaw = parseTokenAmountRaw(info?.tokenAmount?.amount);
    const state = info?.state === 'frozen' ? 'frozen' : info?.state || 'initialized';
    return {
      address,
      amountRaw,
      owner: typeof info?.owner === 'string' ? info.owner : expectedOwner,
      mint: typeof info?.mint === 'string' ? info.mint : expectedMint,
      state,
      spendable: state !== 'frozen' && amountRaw > 0n,
    };
  });
}

export function buildWalletMhoodBalance(params: {
  wallet: string;
  mint: MintDetails;
  accounts: TokenAccountBalance[];
  bypassGate?: boolean;
}): WalletMhoodBalance {
  const totalRaw = sumTokenAccounts(params.accounts);
  const thresholdRaw = thresholdRawFromMint(params.mint);
  const pass = evaluateHolderGate(totalRaw, thresholdRaw) === 'PASS';

  return {
    wallet: params.wallet,
    mint: params.mint.mint,
    decimals: params.mint.decimals,
    tokenProgramKind: params.mint.tokenProgramKind,
    totalRaw,
    accounts: params.accounts,
    meetsAccessThreshold: params.bypassGate ? true : pass,
    fetchedAt: Date.now(),
  };
}

/**
 * Sums every token account for this wallet + MHOOD mint.
 * Uses getTokenAccountsByOwner with jsonParsed encoding (same method
 * web3.js getParsedTokenAccountsByOwner sends). Amounts are integer strings.
 */
export async function fetchWalletMhoodBalance(
  wallet: string,
  options?: {
    connection?: Connection;
    mintDetails?: MintDetails;
  },
): Promise<WalletMhoodBalance> {
  requireConfiguredRpcUrl();
  const mintDetails = options?.mintDetails ?? (await fetchMintDetails(options?.connection));
  const result = await postJsonRpc<JsonRpcContextResult<ParsedTokenAccountResponse[]>>({
    method: HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
    params: [
      wallet,
      { mint: mintDetails.mint },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ],
    stage: 'token-accounts',
  });
  const value = unwrapRpcContextValue<unknown>(result, 'token-accounts', HOLDER_TOKEN_ACCOUNTS_RPC_METHOD);
  if (!Array.isArray(value)) {
    throw new HolderVerificationError({
      stage: 'token-accounts',
      method: HOLDER_TOKEN_ACCOUNTS_RPC_METHOD,
      message: 'Token accounts result.value is not an array',
    });
  }

  let accounts: TokenAccountBalance[];
  try {
    accounts = collectTokenAccountsFromParsed(value, mintDetails.mint, wallet);
  } catch (err) {
    throw HolderVerificationError.from(err, 'balance-parse', HOLDER_TOKEN_ACCOUNTS_RPC_METHOD);
  }

  try {
    return buildWalletMhoodBalance({
      wallet,
      mint: mintDetails,
      accounts,
      bypassGate: isDevBypassGateEnabled(),
    });
  } catch (err) {
    throw HolderVerificationError.from(err, 'threshold-compare', HOLDER_TOKEN_ACCOUNTS_RPC_METHOD);
  }
}

export async function verifyForestAccess(
  wallet: string,
  connection?: Connection,
): Promise<WalletMhoodBalance> {
  const mintDetails = await fetchMintDetails(connection);
  return fetchWalletMhoodBalance(wallet, { mintDetails, connection });
}
