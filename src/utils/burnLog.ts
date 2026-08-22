import { extractErrorMessage } from './devLog';

export type BurnLogStage =
  | 'validation'
  | 'account-fetch'
  | 'build'
  | 'wallet-approval'
  | 'send'
  | 'confirm'
  | 'verify'
  | 'persist';

export function burnLog(message: string, extra?: unknown): void {
  if (extra !== undefined) {
    console.info(`[MoginHood] ${message}`, extra);
    return;
  }
  console.info(`[MoginHood] ${message}`);
}

export function burnErrorLog(stage: BurnLogStage | string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  console.info('[MoginHood] burn error', {
    stage,
    error: extractErrorMessage(error) || String(error),
  });
}
