import { COPY } from '../config/constants';
import { RPC_NOT_CONFIGURED } from '../config/env';

export type HolderRpcErrorView = {
  title: string;
  detail?: string;
};

export type HolderVerificationStage =
  | 'connection-init'
  | 'mint-read'
  | 'token-accounts'
  | 'balance-parse'
  | 'threshold-compare'
  | 'recheck';

export const HOLDER_MINT_RPC_METHOD = 'getAccountInfo';
/** web3.js `getParsedTokenAccountsByOwner` sends this JSON-RPC method with encoding jsonParsed. */
export const HOLDER_TOKEN_ACCOUNTS_RPC_METHOD = 'getTokenAccountsByOwner';

export function extractHolderErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'string') return err;
  return '';
}

export class HolderVerificationError extends Error {
  readonly stage: HolderVerificationStage;
  readonly method?: string;
  readonly transport: boolean;
  readonly details: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(input: {
    stage: HolderVerificationStage;
    message: string;
    method?: string;
    transport?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = 'HolderVerificationError';
    this.stage = input.stage;
    this.method = input.method;
    this.transport = input.transport === true;
    this.details = input.details ?? {};
    this.cause = input.cause;
  }

  static from(
    err: unknown,
    stage: HolderVerificationStage,
    method?: string,
    extras?: { transport?: boolean; details?: Record<string, unknown> },
  ): HolderVerificationError {
    if (err instanceof HolderVerificationError) {
      return err;
    }
    const transport = extras?.transport ?? isTransportRpcError(err);
    return new HolderVerificationError({
      stage,
      method,
      message: extractHolderErrorMessage(err) || 'Holder verification failed',
      transport,
      details: extras?.details,
      cause: err,
    });
  }
}

export function isTransportRpcError(err: unknown): boolean {
  if (err instanceof HolderVerificationError) return err.transport;

  const name = err instanceof Error ? err.name : '';
  const message = extractHolderErrorMessage(err);
  const combined = `${name} ${message}`;

  if (name === 'TimeoutError' || name === 'AbortError') return true;
  if (name === 'TypeError' && /fetch|network/i.test(message)) return true;
  if (/failed to fetch|networkerror|err_network|cors|timeout|aborted|econnrefused|enotfound|etimedout/i.test(combined)) {
    return true;
  }
  if (/Endpoint URL must start with/i.test(message)) return true;
  if (/invalid\/unreachable endpoint|RPC endpoint unavailable|RPC upstream/i.test(message)) return true;
  if (/\b(500|502|503|504)\b/.test(message) && /rpc|proxy|http|upstream|status/i.test(message)) return true;
  return false;
}

export function formatHolderVerificationError(err: unknown): HolderRpcErrorView {
  const message = extractHolderErrorMessage(err);
  if (/not configured/i.test(message)) {
    return { title: RPC_NOT_CONFIGURED };
  }
  if (isTransportRpcError(err)) {
    return {
      title: COPY.rpcUnavailable,
      detail: COPY.rpcUnavailableDetail,
    };
  }
  return { title: COPY.holderVerifyFailed };
}

export function logHolderVerificationFailure(input: {
  err: unknown;
  stage: HolderVerificationStage;
  rpc?: string;
  wallet?: string | null;
  mint?: string;
  method?: string;
}): void {
  const err = input.err;
  const holderError = err instanceof HolderVerificationError ? err : null;
  const cause = holderError?.cause instanceof Error ? holderError.cause : err instanceof Error ? err : null;

  console.info('[MoginHood] holder verification failed', {
    stage: holderError?.stage ?? input.stage,
    name: cause?.name || (err instanceof Error ? err.name : typeof err),
    message: extractHolderErrorMessage(err) || extractHolderErrorMessage(cause),
    stack: cause?.stack,
    method: holderError?.method ?? input.method,
    rpc: input.rpc,
    publicKey: input.wallet,
    mint: input.mint,
    ...holderError?.details,
  });
}
