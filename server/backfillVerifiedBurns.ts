import type { BurnRecord } from '../src/types/index.js';
import { extractVerifiedMhoodBurnRecord } from '../src/services/burnVerificationCore.js';
import { BackfillStageError, backfillLog } from './backfillLog.js';
import {
  KNOWN_BURNER_WALLET,
  KNOWN_MHOOD_BURN_SIGNATURES,
  MHOOD_BURN_DECIMALS,
  MHOOD_BURN_MINT,
} from './knownMhoodBurns.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';
import { fetchParsedBurnTransaction } from './verifyOnChainBurn.js';

export type SeedBackfillResult = {
  mode: 'seed';
  verified: number;
  inserted: number;
  alreadyIndexed: number;
  failed: number;
  records: BurnRecord[];
  alreadyIndexedSignatures: string[];
  failures: Array<{ signature: string; reason: string }>;
};

function uniqueSignatures(signatures: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const signature of signatures) {
    const trimmed = signature.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered;
}

function asStageError(err: unknown, stage: string, status: number): BackfillStageError {
  if (err instanceof BackfillStageError) return err;
  const message = err instanceof Error ? err.message : 'Backfill stage failed';
  return new BackfillStageError(stage, message, status);
}

/**
 * Fast one-time import: verify known signatures with getTransaction only.
 * Does not scan wallet/mint history.
 */
export async function backfillSeedSignatures(input: {
  rpcUrl: string;
  store: VerifiedBurnStore;
  signatures?: readonly string[];
  expectedWallet?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  verify?: (signature: string) => Promise<BurnRecord>;
  signal?: AbortSignal;
}): Promise<SeedBackfillResult> {
  const signatures = uniqueSignatures(input.signatures ?? KNOWN_MHOOD_BURN_SIGNATURES);
  const expectedWallet = input.expectedWallet ?? KNOWN_BURNER_WALLET;
  const records: BurnRecord[] = [];
  const alreadyIndexedSignatures: string[] = [];
  const failures: Array<{ signature: string; reason: string }> = [];

  backfillLog(`seed count: ${signatures.length}`);

  for (let index = 0; index < signatures.length; index += 1) {
    const signature = signatures[index]!;
    const seed = `seed ${index + 1}`;
    backfillLog(`${seed} existing read start`);
    let existing: BurnRecord | null;
    try {
      existing = await input.store.get(signature);
    } catch (err) {
      throw asStageError(err, 'store-read', 502);
    }
    backfillLog(`${seed} existing read complete`);
    if (existing) {
      alreadyIndexedSignatures.push(signature);
      backfillLog(`${seed} complete`);
      continue;
    }

    try {
      let record: BurnRecord;
      if (input.verify) {
        record = await input.verify(signature);
      } else {
        backfillLog(`${seed} helius start`);
        let parsed;
        try {
          parsed = await fetchParsedBurnTransaction(
            input.rpcUrl,
            signature,
            input.fetchImpl,
            input.timeoutMs,
            (_status, durationMs) => {
              backfillLog(`${seed} helius complete`, { durationMs });
            },
            input.signal,
          );
        } catch (err) {
          throw asStageError(err, 'helius-rpc', 502);
        }
        if (!parsed) {
          throw new Error('The forest could not confirm the burn.');
        }
        record = extractVerifiedMhoodBurnRecord({
          signature,
          parsed,
          mint: MHOOD_BURN_MINT,
          decimals: MHOOD_BURN_DECIMALS,
          expectedWallet,
        });
        backfillLog(`${seed} verify complete`);
      }

      backfillLog(`${seed} write start`);
      let saved: { record: BurnRecord; added: boolean };
      try {
        saved = await input.store.add(record);
      } catch (err) {
        throw asStageError(err, 'store-write', 502);
      }
      backfillLog(`${seed} write complete`);
      if (saved.added) records.push(saved.record);
      else alreadyIndexedSignatures.push(signature);
    } catch (err) {
      if (err instanceof BackfillStageError) throw err;
      failures.push({
        signature,
        reason: err instanceof Error ? err.message : 'Rejected burn candidate',
      });
    }
    backfillLog(`${seed} complete`);
  }

  const inserted = records.length;
  const alreadyIndexed = alreadyIndexedSignatures.length;
  const failed = failures.length;
  const verified = inserted + alreadyIndexed;
  return {
    mode: 'seed',
    verified,
    inserted,
    alreadyIndexed,
    failed,
    records,
    alreadyIndexedSignatures,
    failures,
  };
}

/** Seed-only alias used by the admin endpoint. History scan is a separate module. */
export async function backfillVerifiedBurns(
  input: Parameters<typeof backfillSeedSignatures>[0],
): Promise<SeedBackfillResult> {
  return backfillSeedSignatures(input);
}
