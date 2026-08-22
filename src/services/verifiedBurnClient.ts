import type { BurnPersistenceMode, BurnRecord } from '../types';

export const VERIFIED_BURNS_PATH = '/api/verified-burns';

export async function fetchVerifiedBurnLedger(): Promise<{
  records: BurnRecord[];
  persistence: BurnPersistenceMode;
}> {
  try {
    const response = await fetch(VERIFIED_BURNS_PATH);
    if (!response.ok) return { records: [], persistence: 'local' };
    const payload = (await response.json()) as {
      records?: BurnRecord[];
      persistence?: BurnPersistenceMode;
    };
    const records = Array.isArray(payload.records)
      ? payload.records.filter((record) => !record.simulated)
      : [];
    return {
      records,
      persistence: payload.persistence === 'inactive' ? 'inactive' : 'local',
    };
  } catch {
    return { records: [], persistence: 'local' };
  }
}

export async function fetchVerifiedBurnRecords(): Promise<BurnRecord[]> {
  const ledger = await fetchVerifiedBurnLedger();
  return ledger.records;
}

export async function submitVerifiedBurnSignature(signature: string): Promise<BurnRecord> {
  const response = await fetch(VERIFIED_BURNS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    record?: BurnRecord;
    error?: string;
  };
  if (!response.ok || !payload.record) {
    throw new Error(payload.error || 'The forest could not confirm the burn.');
  }
  return payload.record;
}
