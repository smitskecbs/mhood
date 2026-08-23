import type { VerifiedBurnStore } from './verifiedBurnStore.js';
import {
  createUpstashVerifiedBurnStore,
  InactiveVerifiedBurnStore,
} from './verifiedBurnStore.js';
import { FileVerifiedBurnStore, fileVerifiedBurnStorePath } from './fileVerifiedBurnStore.js';

export function createVerifiedBurnStore(
  env: NodeJS.Dict<string> = process.env,
  options?: { fileRoot?: string; fetchImpl?: typeof fetch; upstashTimeoutMs?: number; signal?: AbortSignal },
): VerifiedBurnStore {
  const upstash = createUpstashVerifiedBurnStore(
    env,
    options?.fetchImpl,
    options?.upstashTimeoutMs,
    options?.signal,
  );
  if (upstash) return upstash;
  if (options?.fileRoot) {
    return new FileVerifiedBurnStore(fileVerifiedBurnStorePath(options.fileRoot));
  }
  return new InactiveVerifiedBurnStore();
}
