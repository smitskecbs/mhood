import type { BurnRecord } from '../src/types/index.js';
import {
  KNOWN_BURNER_WALLET,
  KNOWN_MHOOD_BURN_SIGNATURES,
  MHOOD_BURN_MINT,
} from './knownMhoodBurns.js';
import { listSignaturesForAddress } from './solanaJsonRpc.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';
import { verifyOnChainMhoodBurn } from './verifyOnChainBurn.js';

export type BackfillResult = {
  scanned: number;
  imported: BurnRecord[];
  duplicates: string[];
  rejected: Array<{ signature: string; reason: string }>;
};

export async function collectBackfillSignatures(input: {
  rpcUrl: string;
  mint?: string;
  wallet?: string;
  seedSignatures?: readonly string[];
  fetchImpl?: typeof fetch;
  listSignatures?: (address: string) => Promise<string[]>;
}): Promise<string[]> {
  const mint = input.mint ?? MHOOD_BURN_MINT;
  const wallet = input.wallet ?? KNOWN_BURNER_WALLET;
  const seed = input.seedSignatures ?? KNOWN_MHOOD_BURN_SIGNATURES;
  const found = new Set<string>(seed);
  const list =
    input.listSignatures ??
    ((address: string) =>
      listSignaturesForAddress(input.rpcUrl, address, { fetchImpl: input.fetchImpl }));
  for (const address of [wallet, mint]) {
    const signatures = await list(address);
    for (const signature of signatures) found.add(signature);
  }
  return [...found];
}

export async function backfillVerifiedBurns(input: {
  rpcUrl: string;
  store: VerifiedBurnStore;
  mint?: string;
  wallet?: string;
  seedSignatures?: readonly string[];
  fetchImpl?: typeof fetch;
  listSignatures?: (address: string) => Promise<string[]>;
  verify?: (signature: string) => Promise<BurnRecord>;
}): Promise<BackfillResult> {
  const signatures = await collectBackfillSignatures(input);
  const imported: BurnRecord[] = [];
  const duplicates: string[] = [];
  const rejected: Array<{ signature: string; reason: string }> = [];
  const verify =
    input.verify ??
    ((signature: string) =>
      verifyOnChainMhoodBurn({
        signature,
        rpcUrl: input.rpcUrl,
        fetchImpl: input.fetchImpl,
      }));

  for (const signature of signatures) {
    const existing = await input.store.get(signature);
    if (existing) {
      duplicates.push(signature);
      continue;
    }
    try {
      const record = await verify(signature);
      const saved = await input.store.add(record);
      if (saved.added) imported.push(saved.record);
      else duplicates.push(signature);
    } catch (err) {
      rejected.push({
        signature,
        reason: err instanceof Error ? err.message : 'Rejected burn candidate',
      });
    }
  }

  console.info(
    `[MoginHood] backfill scanned=${signatures.length} imported=${imported.length} duplicates=${duplicates.length} rejected=${rejected.length}`,
  );
  return { scanned: signatures.length, imported, duplicates, rejected };
}
