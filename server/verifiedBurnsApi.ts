import { upsertVerifiedBurn } from '../src/services/burnVerificationCore.js';
import type { BurnRecord } from '../src/types/index.js';
import type { BurnPersistenceMode } from '../src/types/index.js';
import type { VerifiedBurnStore } from './verifiedBurnStore.js';
import { InactiveVerifiedBurnStore } from './verifiedBurnStore.js';
import { verifyOnChainMhoodBurn } from './verifyOnChainBurn.js';

export const VERIFIED_BURNS_MINT = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';
export const VERIFIED_BURNS_DECIMALS = 6;

export type VerifiedBurnsGetBody = {
  records: BurnRecord[];
  persistence: BurnPersistenceMode;
};

function serverBurnLog(message: string): void {
  console.info(`[MoginHood] ${message}`);
}

export function verifiedBurnsGetBody(
  records: BurnRecord[],
  persistence: BurnPersistenceMode,
): VerifiedBurnsGetBody {
  return {
    records: persistence === 'inactive' ? [] : records.filter((record) => !record.simulated),
    persistence,
  };
}

export async function verifyBurnSignature(input: {
  signature: string;
  rpcUrl: string;
  existing: BurnRecord[];
  expectedWallet?: string;
  fetchImpl?: typeof fetch;
  verify?: typeof verifyOnChainMhoodBurn;
}): Promise<{ record: BurnRecord; added: boolean }> {
  const duplicate = input.existing.find((record) => record.signature === input.signature);
  if (duplicate) {
    serverBurnLog(`duplicate signature ignored: ${input.signature}`);
    return { record: duplicate, added: false };
  }

  serverBurnLog(`verifying burn: ${input.signature}`);
  const verify = input.verify ?? verifyOnChainMhoodBurn;
  const record = await verify({
    signature: input.signature,
    rpcUrl: input.rpcUrl,
    expectedWallet: input.expectedWallet,
    fetchImpl: input.fetchImpl,
  });
  serverBurnLog('verification success');
  const next = upsertVerifiedBurn(input.existing, record);
  return { record, added: next.added };
}

export async function handleVerifiedBurnsRequest(input: {
  httpMethod: string;
  body: unknown;
  rpcUrl: string;
  store?: VerifiedBurnStore;
  persistence?: BurnPersistenceMode;
  records?: BurnRecord[];
  persist?: (record: BurnRecord) => BurnRecord[];
  verify?: typeof verifyBurnSignature;
}): Promise<{ status: number; body: unknown }> {
  const store = input.store ?? new InactiveVerifiedBurnStore();
  try {
    if (input.httpMethod === 'GET') {
      const records = input.records ?? (await store.list());
      const persistence = input.persistence ?? store.persistence;
      if (persistence === 'inactive') {
        serverBurnLog('burn persistence: inactive');
      }
      return { status: 200, body: verifiedBurnsGetBody(records, persistence) };
    }

    if (input.httpMethod !== 'POST') {
      return { status: 405, body: { error: 'Method not allowed', persistence: store.persistence } };
    }

    const signature =
      input.body && typeof input.body === 'object' && !Array.isArray(input.body)
        ? typeof (input.body as { signature?: unknown }).signature === 'string'
          ? (input.body as { signature: string }).signature.trim()
          : ''
        : '';
    if (!signature) {
      serverBurnLog('verification failed: missing signature');
      return {
        status: 400,
        body: { verified: false, persistence: store.persistence, error: 'Missing transaction signature.' },
      };
    }

    if (!input.rpcUrl.trim()) {
      serverBurnLog('burn persistence: inactive');
      return {
        status: 200,
        body: {
          verified: false,
          persistence: 'inactive',
          error: 'Solana RPC endpoint is not configured.',
        },
      };
    }

    const verify = input.verify ?? verifyBurnSignature;
    const existing = store.persistence === 'inactive' ? (input.records ?? []) : await store.list();
    const result = await verify({ signature, rpcUrl: input.rpcUrl, existing });
    let added = result.added;
    if (store.persistence !== 'inactive') {
      const saved = await store.add(result.record);
      added = saved.added;
      if (saved.added) serverBurnLog('record stored');
      else serverBurnLog(`duplicate signature ignored: ${signature}`);
    } else if (input.persistence === 'local' && input.persist && result.added) {
      input.persist(result.record);
      serverBurnLog('record stored');
    } else if (store.persistence === 'inactive') {
      serverBurnLog('burn persistence: inactive');
    }
    return {
      status: 200,
      body: {
        verified: true,
        record: result.record,
        persistence: store.persistence,
        added: Boolean(added && store.persistence !== 'inactive'),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
    if (input.httpMethod === 'GET') {
      serverBurnLog('burn persistence: inactive');
      return { status: 200, body: { records: [], persistence: 'inactive' } };
    }
    serverBurnLog(`verification failed: ${message}`);
    return {
      status: 400,
      body: { verified: false, persistence: store.persistence, error: message },
    };
  }
}

export { authorizeBackfillRequest, backfillSecretFromEnv } from './backfillAuth.js';
