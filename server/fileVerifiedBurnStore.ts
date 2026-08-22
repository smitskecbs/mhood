import fs from 'node:fs';
import path from 'node:path';
import type { BurnPersistenceMode, BurnRecord } from '../src/types/index.js';
import { isBurnRecord, sortBurnRecords, type VerifiedBurnStore } from './verifiedBurnStore.js';

type StoreFile = { records: BurnRecord[] };

export class FileVerifiedBurnStore implements VerifiedBurnStore {
  readonly kind = 'file';
  readonly persistence: BurnPersistenceMode = 'local';

  constructor(private readonly filePath: string) {}

  private read(): BurnRecord[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StoreFile;
      const records = Array.isArray(parsed.records) ? parsed.records.filter(isBurnRecord) : [];
      return sortBurnRecords(records.filter((record) => !record.simulated));
    } catch {
      return [];
    }
  }

  private write(records: BurnRecord[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify({ records: sortBurnRecords(records) }, null, 2)}\n`, 'utf8');
  }

  async list(): Promise<BurnRecord[]> {
    return this.read();
  }

  async get(signature: string): Promise<BurnRecord | null> {
    return this.read().find((record) => record.signature === signature) ?? null;
  }

  async add(record: BurnRecord): Promise<{ record: BurnRecord; added: boolean }> {
    const records = this.read();
    const existing = records.find((item) => item.signature === record.signature);
    if (existing) return { record: existing, added: false };
    this.write([...records, record]);
    return { record, added: true };
  }

  async health(): Promise<void> {}
}

export function fileVerifiedBurnStorePath(root: string): string {
  return path.join(root, 'data', 'verified-burns.json');
}
