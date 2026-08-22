import type { BurnRecord } from '../src/types/index.js';
import {
  KNOWN_BURNER_WALLET,
  KNOWN_MHOOD_BURN_SIGNATURES,
} from './knownMhoodBurns.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';
import { verifyOnChainMhoodBurn } from './verifyOnChainBurn.js';

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
}): Promise<SeedBackfillResult> {
  const signatures = uniqueSignatures(input.signatures ?? KNOWN_MHOOD_BURN_SIGNATURES);
  const expectedWallet = input.expectedWallet ?? KNOWN_BURNER_WALLET;
  const records: BurnRecord[] = [];
  const alreadyIndexedSignatures: string[] = [];
  const failures: Array<{ signature: string; reason: string }> = [];
  const verify =
    input.verify ??
    ((signature: string) =>
      verifyOnChainMhoodBurn({
        signature,
        rpcUrl: input.rpcUrl,
        expectedWallet,
        fetchImpl: input.fetchImpl,
        timeoutMs: input.timeoutMs,
      }));

  for (const signature of signatures) {
    const existing = await input.store.get(signature);
    if (existing) {
      alreadyIndexedSignatures.push(signature);
      continue;
    }
    try {
      const record = await verify(signature);
      const saved = await input.store.add(record);
      if (saved.added) records.push(saved.record);
      else alreadyIndexedSignatures.push(signature);
    } catch (err) {
      failures.push({
        signature,
        reason: err instanceof Error ? err.message : 'Rejected burn candidate',
      });
    }
  }

  const inserted = records.length;
  const alreadyIndexed = alreadyIndexedSignatures.length;
  const failed = failures.length;
  const verified = inserted + alreadyIndexed;
  console.info(
    `[MoginHood] seed backfill verified=${verified} inserted=${inserted} alreadyIndexed=${alreadyIndexed} failed=${failed}`,
  );
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
