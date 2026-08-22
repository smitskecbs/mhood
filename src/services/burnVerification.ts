import {
  BurnVerificationError,
  extractVerifiedMhoodBurnRecord,
  type BurnVerificationExpectation,
} from './burnVerificationCore';
import type { BurnRecord } from '../types/index';

export {
  BurnVerificationError,
  collectBurnCheckedInstructions,
  decodeBase58Bytes,
  extractBurnCheckedFromCompiledInstruction,
  extractBurnCheckedFromParsedInstruction,
  extractBurnCheckedInstruction,
  extractVerifiedMhoodBurnRecord,
  toBurnRecord,
  upsertVerifiedBurn,
  verifyExtractedBurns,
} from './burnVerificationCore';
export type { BurnVerificationExpectation, ExtractedBurnChecked } from './burnVerificationCore';

type ParsedBurnTransaction = {
  slot: number;
  blockTime?: number | null;
  transaction?: { message?: { instructions?: readonly unknown[] } };
  meta?: {
    err?: unknown;
    innerInstructions?: readonly { instructions?: readonly unknown[] }[] | null;
  } | null;
};

/** Duck-typed HTTP RPC client. Avoids importing @solana/web3.js in this module. */
type ParsedTransactionRpc = {
  getParsedTransaction: (
    signature: string,
    options: { commitment: 'confirmed'; maxSupportedTransactionVersion: number },
  ) => Promise<ParsedBurnTransaction | null>;
};

async function fetchParsedTransaction(
  connection: ParsedTransactionRpc,
  signature: string,
  attempts = 8,
): Promise<ParsedBurnTransaction> {
  let last: ParsedBurnTransaction | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new BurnVerificationError('The forest could not confirm the burn.');
}

/**
 * Client-side confirmation after a wallet send.
 * Server/backfill must import burnVerificationCore instead — this file is client-only.
 */
export async function confirmAndVerifyBurn(
  connection: ParsedTransactionRpc,
  signature: string,
  expected: BurnVerificationExpectation,
  decimals: number,
): Promise<BurnRecord> {
  const parsed = await fetchParsedTransaction(connection, signature);
  const record = extractVerifiedMhoodBurnRecord({
    signature,
    parsed,
    mint: expected.mint,
    decimals,
    expectedWallet: expected.wallet,
  });
  if (BigInt(record.amountRaw) !== expected.amountRaw) {
    throw new BurnVerificationError('Verified burn amount does not match the prepared amount.');
  }
  return record;
}
