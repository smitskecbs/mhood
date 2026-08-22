import { requireConfiguredRpcUrl } from '../../config/env';
import {
  HolderVerificationError,
  type HolderVerificationStage,
} from '../../utils/holderVerificationError';

export const CLIENT_RPC_TIMEOUT_MS = 20_000;

export type JsonRpcContextResult<T> = {
  context?: { slot?: number; apiVersion?: string };
  value: T;
};

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(ms), clear: () => undefined };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export function unwrapJsonRpcPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Unexpected RPC response shape');
  }
  const body = payload as { error?: { message?: unknown }; result?: unknown; jsonrpc?: unknown };
  if (body.error) {
    const message = typeof body.error.message === 'string' ? body.error.message : 'JSON-RPC error';
    throw new Error(message);
  }
  if (!('result' in body)) {
    throw new Error('RPC response is missing result');
  }
  return body.result;
}

export function unwrapRpcContextValue<T>(result: unknown, stage: HolderVerificationStage, method: string): T {
  if (!result || typeof result !== 'object' || !('value' in result)) {
    throw new HolderVerificationError({
      stage,
      method,
      message: 'RPC result is missing value',
    });
  }
  return (result as { value: T }).value;
}

export async function postJsonRpc<T>(input: {
  method: string;
  params: unknown[];
  stage: HolderVerificationStage;
  rpcUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<T> {
  const rpcUrl = input.rpcUrl ?? requireConfiguredRpcUrl();
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeout = timeoutSignal(input.timeoutMs ?? CLIENT_RPC_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: input.method,
        params: input.params,
      }),
      signal: timeout.signal,
    });
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || /timeout|aborted/i.test(err.message));
    throw new HolderVerificationError({
      stage: input.stage,
      method: input.method,
      message: timedOut ? `RPC request timed out (${input.method})` : extractFetchMessage(err),
      transport: true,
      cause: err,
    });
  } finally {
    timeout.clear();
  }

  const transportHttp = response.status >= 500 || response.status === 0;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    throw new HolderVerificationError({
      stage: input.stage,
      method: input.method,
      message: `Invalid RPC JSON (HTTP ${response.status})`,
      transport: transportHttp || response.status >= 500,
      cause: err,
    });
  }

  try {
    return unwrapJsonRpcPayload(payload) as T;
  } catch (err) {
    throw new HolderVerificationError({
      stage: input.stage,
      method: input.method,
      message: err instanceof Error ? err.message : `RPC request failed (HTTP ${response.status})`,
      transport: transportHttp,
      cause: err,
    });
  }
}

function extractFetchMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'RPC network request failed';
}
