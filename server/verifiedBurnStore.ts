import type { BurnPersistenceMode, BurnRecord } from '../src/types/index.js';

export const VERIFIED_BURNS_REDIS_KEY = 'moginhood:verified-burns';

export type VerifiedBurnStoreKind = 'memory' | 'file' | 'upstash' | 'inactive';

export interface VerifiedBurnStore {
  readonly kind: VerifiedBurnStoreKind;
  readonly persistence: BurnPersistenceMode;
  list(): Promise<BurnRecord[]>;
  get(signature: string): Promise<BurnRecord | null>;
  add(record: BurnRecord): Promise<{ record: BurnRecord; added: boolean }>;
}

export function isBurnRecord(value: unknown): value is BurnRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.signature === 'string' &&
    typeof record.wallet === 'string' &&
    typeof record.mint === 'string' &&
    typeof record.amountRaw === 'string' &&
    typeof record.amountUi === 'string' &&
    typeof record.slot === 'number' &&
    (record.timestamp === null || typeof record.timestamp === 'number')
  );
}

export function sortBurnRecords(records: BurnRecord[]): BurnRecord[] {
  return [...records].sort((left, right) => {
    if (left.slot !== right.slot) return left.slot - right.slot;
    return left.signature.localeCompare(right.signature);
  });
}

export class MemoryVerifiedBurnStore implements VerifiedBurnStore {
  readonly kind = 'memory';
  readonly persistence: BurnPersistenceMode = 'persistent';
  private readonly records = new Map<string, BurnRecord>();

  constructor(seed: BurnRecord[] = []) {
    for (const record of seed) {
      this.records.set(record.signature, record);
    }
  }

  async list(): Promise<BurnRecord[]> {
    return sortBurnRecords([...this.records.values()]);
  }

  async get(signature: string): Promise<BurnRecord | null> {
    return this.records.get(signature) ?? null;
  }

  async add(record: BurnRecord): Promise<{ record: BurnRecord; added: boolean }> {
    const existing = this.records.get(record.signature);
    if (existing) return { record: existing, added: false };
    this.records.set(record.signature, record);
    return { record, added: true };
  }
}

export class InactiveVerifiedBurnStore implements VerifiedBurnStore {
  readonly kind = 'inactive';
  readonly persistence: BurnPersistenceMode = 'inactive';

  async list(): Promise<BurnRecord[]> {
    return [];
  }

  async get(_signature: string): Promise<BurnRecord | null> {
    return null;
  }

  async add(record: BurnRecord): Promise<{ record: BurnRecord; added: boolean }> {
    return { record, added: false };
  }
}

export type RedisCommandExecutor = (command: string[]) => Promise<unknown>;

function parseStoredRecord(value: unknown): BurnRecord | null {
  if (isBurnRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isBurnRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export class UpstashVerifiedBurnStore implements VerifiedBurnStore {
  readonly kind = 'upstash';
  readonly persistence: BurnPersistenceMode = 'persistent';

  constructor(private readonly execute: RedisCommandExecutor) {}

  async list(): Promise<BurnRecord[]> {
    const values = await this.execute(['HVALS', VERIFIED_BURNS_REDIS_KEY]);
    const records = Array.isArray(values)
      ? values.map((value) => parseStoredRecord(value)).filter((record): record is BurnRecord => Boolean(record))
      : [];
    return sortBurnRecords(records);
  }

  async get(signature: string): Promise<BurnRecord | null> {
    const value = await this.execute(['HGET', VERIFIED_BURNS_REDIS_KEY, signature]);
    return parseStoredRecord(value);
  }

  async add(record: BurnRecord): Promise<{ record: BurnRecord; added: boolean }> {
    const added = await this.execute([
      'HSETNX',
      VERIFIED_BURNS_REDIS_KEY,
      record.signature,
      JSON.stringify(record),
    ]);
    if (added === 1 || added === '1' || added === true) {
      return { record, added: true };
    }
    const existing = await this.get(record.signature);
    return { record: existing ?? record, added: false };
  }
}

export function readUpstashCredentials(env: NodeJS.Dict<string>): { url: string; token: string } | null {
  const url = (env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '').trim();
  const token = (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

export async function executeUpstashCommand(
  credentials: { url: string; token: string },
  command: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(credentials.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const payload = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Upstash Redis request failed (${response.status})`);
  }
  return payload.result;
}

export function createUpstashVerifiedBurnStore(
  env: NodeJS.Dict<string>,
  fetchImpl: typeof fetch = fetch,
): UpstashVerifiedBurnStore | null {
  const credentials = readUpstashCredentials(env);
  if (!credentials) return null;
  return new UpstashVerifiedBurnStore((command) => executeUpstashCommand(credentials, command, fetchImpl));
}
