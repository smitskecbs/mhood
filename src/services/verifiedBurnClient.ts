import type { BurnRecord } from '../types';

export const VERIFIED_BURNS_PATH = '/api/verified-burns';

export async function fetchVerifiedBurnRecords(): Promise<BurnRecord[]> {
  try {
    const response = await fetch(VERIFIED_BURNS_PATH);
    if (!response.ok) return [];
    const payload = (await response.json()) as { records?: BurnRecord[] };
    return Array.isArray(payload.records) ? payload.records.filter((record) => !record.simulated) : [];
  } catch {
    return [];
  }
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
