import { PublicKey, type Connection } from '@solana/web3.js';
import type { MintDetails, TokenAccountBalance, WalletMhoodBalance } from '../types';
import { appConfig, isDevBypassGateEnabled, requireConfiguredRpcUrl } from '../config/env';
import { uiAmountToRaw } from '../utils/tokenAmount';
import { evaluateHolderGate } from '../utils/access';
import { sumTokenAccounts } from '../utils/accounts';
import { getConnection } from './solana/connection';
import { fetchMintDetails } from './solana/mintService';

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
          tokenAmount?: { amount?: string | number };
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
 * Uses a mint filter (classic SPL getTokenAccountsByOwner).
 * Amounts are read as integer strings and converted to bigint — never uiAmount floats.
 */
export async function fetchWalletMhoodBalance(
  wallet: string,
  options?: {
    connection?: Connection;
    mintDetails?: MintDetails;
  },
): Promise<WalletMhoodBalance> {
  requireConfiguredRpcUrl();
  const connection = options?.connection ?? getConnection();
  const mintDetails = options?.mintDetails ?? (await fetchMintDetails(connection));
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(mintDetails.mint);

  const response = await connection.getParsedTokenAccountsByOwner(owner, { mint }, 'confirmed');
  const accounts = collectTokenAccountsFromParsed(response.value, mintDetails.mint, wallet);

  return buildWalletMhoodBalance({
    wallet,
    mint: mintDetails,
    accounts,
    bypassGate: isDevBypassGateEnabled(),
  });
}

export async function verifyForestAccess(
  wallet: string,
  connection?: Connection,
): Promise<WalletMhoodBalance> {
  const mintDetails = await fetchMintDetails(connection);
  return fetchWalletMhoodBalance(wallet, { mintDetails, connection });
}
