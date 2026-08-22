import { extractVerifiedMhoodBurnRecord } from '../src/services/burnVerificationCore.js';
import type { BurnRecord } from '../src/types/index.js';
import { MHOOD_BURN_DECIMALS, MHOOD_BURN_MINT } from './knownMhoodBurns.js';
import { heliusRpc } from './solanaJsonRpc.js';

export type ParsedBurnTransaction = {
  slot: number;
  blockTime?: number | null;
  transaction?: { message?: { instructions?: readonly unknown[] } };
  meta?: {
    err?: unknown;
    innerInstructions?: readonly { instructions?: readonly unknown[] }[] | null;
  } | null;
};

export async function fetchParsedBurnTransaction(
  rpcUrl: string,
  signature: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs?: number,
  onResponse?: (status: number, durationMs: number) => void,
): Promise<ParsedBurnTransaction | null> {
  return heliusRpc<ParsedBurnTransaction | null>(
    'getTransaction',
    [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }],
    { rpcUrl, fetchImpl, timeoutMs, onResponse },
  );
}

export async function verifyOnChainMhoodBurn(input: {
  signature: string;
  rpcUrl: string;
  expectedWallet?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  fetchTransaction?: (signature: string) => Promise<ParsedBurnTransaction | null>;
  onRpcResponse?: (status: number, durationMs: number) => void;
}): Promise<BurnRecord> {
  const parsed = input.fetchTransaction
    ? await input.fetchTransaction(input.signature)
    : await fetchParsedBurnTransaction(
        input.rpcUrl,
        input.signature,
        input.fetchImpl,
        input.timeoutMs,
        input.onRpcResponse,
      );
  if (!parsed) {
    throw new Error('The forest could not confirm the burn.');
  }
  return extractVerifiedMhoodBurnRecord({
    signature: input.signature,
    parsed,
    mint: MHOOD_BURN_MINT,
    decimals: MHOOD_BURN_DECIMALS,
    expectedWallet: input.expectedWallet,
  });
}
