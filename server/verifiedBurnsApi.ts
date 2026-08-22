import { Connection } from '@solana/web3.js';
import {
  collectBurnCheckedInstructions,
  confirmAndVerifyBurn,
  upsertVerifiedBurn,
} from '../src/services/burnVerification';
import type { BurnRecord } from '../src/types';

export const VERIFIED_BURNS_MINT = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';
export const VERIFIED_BURNS_DECIMALS = 6;

export type BurnPersistenceMode = 'local' | 'inactive';

export type VerifiedBurnsGetBody = {
  records: BurnRecord[];
  persistence: BurnPersistenceMode;
};

function serverBurnLog(message: string): void {
  console.info(`[MoginHood server] ${message}`);
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
}): Promise<{ record: BurnRecord; added: boolean }> {
  const duplicate = input.existing.find((record) => record.signature === input.signature);
  if (duplicate) {
    serverBurnLog(`duplicate signature ignored: ${input.signature}`);
    return { record: duplicate, added: false };
  }

  serverBurnLog(`verifying burn: ${input.signature}`);
  const connection = new Connection(input.rpcUrl, 'confirmed');
  const parsedTx = await connection.getParsedTransaction(input.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!parsedTx) {
    throw new Error('The forest could not confirm the burn.');
  }

  const burns = collectBurnCheckedInstructions({
    transaction: parsedTx.transaction,
    meta: parsedTx.meta,
  });
  if (burns.length === 0) {
    throw new Error('Transaction does not contain a MHOOD BurnChecked instruction.');
  }
  const amountRaw = burns.reduce((total, burn) => total + burn.amountRaw, 0n);
  const wallet = burns[0]?.wallet ?? '';

  const record = await confirmAndVerifyBurn(
    connection,
    input.signature,
    { mint: VERIFIED_BURNS_MINT, wallet, amountRaw },
    VERIFIED_BURNS_DECIMALS,
  );
  serverBurnLog('verification success');
  const next = upsertVerifiedBurn(input.existing, record);
  return { record, added: next.added };
}

export async function handleVerifiedBurnsRequest(input: {
  httpMethod: string;
  body: unknown;
  persistence: BurnPersistenceMode;
  records: BurnRecord[];
  rpcUrl: string;
  persist?: (record: BurnRecord) => BurnRecord[];
}): Promise<{ status: number; body: unknown }> {
  if (input.httpMethod === 'GET') {
    return { status: 200, body: verifiedBurnsGetBody(input.records, input.persistence) };
  }

  if (input.httpMethod !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  if (!input.rpcUrl.trim()) {
    serverBurnLog('verification failed: RPC not configured');
    return { status: 503, body: { error: 'Solana RPC endpoint is not configured.' } };
  }

  const signature =
    input.body && typeof input.body === 'object' && !Array.isArray(input.body)
      ? typeof (input.body as { signature?: unknown }).signature === 'string'
        ? (input.body as { signature: string }).signature.trim()
        : ''
      : '';
  if (!signature) {
    serverBurnLog('verification failed: missing signature');
    return { status: 400, body: { error: 'Missing transaction signature.' } };
  }

  try {
    const existing = input.persistence === 'inactive' ? [] : input.records;
    const result = await verifyBurnSignature({ signature, rpcUrl: input.rpcUrl, existing });
    if (input.persistence === 'local' && input.persist && result.added) {
      input.persist(result.record);
      serverBurnLog('record stored');
    }
    const persisted = input.persistence === 'local';
    return {
      status: result.added && persisted ? 201 : 200,
      body: { record: result.record, added: result.added && persisted, persisted },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The forest could not confirm the burn.';
    serverBurnLog(`verification failed: ${message}`);
    return { status: 400, body: { error: message } };
  }
}
