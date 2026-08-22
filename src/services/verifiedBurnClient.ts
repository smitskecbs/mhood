import type { BurnPersistenceMode, BurnRecord } from '../types';
import { burnLog } from '../utils/burnLog';

export const VERIFIED_BURNS_PATH = '/api/verified-burns';

export type VerifiedBurnSubmitResult = {
  verified: boolean;
  record?: BurnRecord;
  persistence: BurnPersistenceMode;
};

function persistenceMode(value: unknown, fallback: BurnPersistenceMode): BurnPersistenceMode {
  if (value === 'inactive' || value === 'local' || value === 'persistent') return value;
  return fallback;
}

export async function fetchVerifiedBurnLedger(): Promise<{
  records: BurnRecord[];
  persistence: BurnPersistenceMode;
}> {
  try {
    const response = await fetch(VERIFIED_BURNS_PATH);
    if (!response.ok) return { records: [], persistence: 'inactive' };
    const payload = (await response.json()) as {
      records?: BurnRecord[];
      persistence?: BurnPersistenceMode;
    };
    const records = Array.isArray(payload.records)
      ? payload.records.filter((record) => !record.simulated)
      : [];
    return {
      records: payload.persistence === 'inactive' ? [] : records,
      persistence: persistenceMode(payload.persistence, 'local'),
    };
  } catch {
    return { records: [], persistence: 'inactive' };
  }
}

export async function fetchVerifiedBurnRecords(): Promise<BurnRecord[]> {
  const ledger = await fetchVerifiedBurnLedger();
  return ledger.records;
}

export async function submitVerifiedBurnSignature(signature: string): Promise<VerifiedBurnSubmitResult> {
  try {
    const response = await fetch(VERIFIED_BURNS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      verified?: boolean;
      record?: BurnRecord;
      persistence?: BurnPersistenceMode;
      error?: string;
    };
    const persistence = persistenceMode(
      payload.persistence,
      response.ok ? 'local' : 'inactive',
    );
    if (persistence === 'inactive') {
      burnLog('burn persistence: inactive');
    }
    return {
      verified: payload.verified === true || Boolean(payload.record),
      record: payload.record,
      persistence,
    };
  } catch {
    burnLog('burn persistence: inactive');
    return { verified: false, persistence: 'inactive' };
  }
}
