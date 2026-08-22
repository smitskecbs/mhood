import { COPY } from '../config/constants';
import { RPC_NOT_CONFIGURED } from '../config/env';

export function devLog(event: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    console.info(`[MoginHood] ${event}`, data);
    return;
  }
  console.info(`[MoginHood] ${event}`);
}

export function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'string') return err;
  return '';
}

export type HolderRpcErrorView = {
  title: string;
  detail?: string;
};

export function formatHolderRpcError(err: unknown): HolderRpcErrorView {
  const message = extractErrorMessage(err);
  if (/not configured/i.test(message)) {
    return { title: RPC_NOT_CONFIGURED };
  }
  return {
    title: COPY.rpcUnavailable,
    detail: COPY.rpcUnavailableDetail,
  };
}

/** Technical detail for the development console only. */
export function formatRpcError(err: unknown): string {
  const message = extractErrorMessage(err);
  if (/403|forbidden/i.test(message)) {
    return 'RPC 403 Forbidden — the configured endpoint rejected the browser request.';
  }
  if (/429|too many requests|rate limit/i.test(message)) {
    return 'RPC rate-limited.';
  }
  if (/failed to fetch|networkerror|cors/i.test(message)) {
    return `RPC request failed (${message || 'network error'}).`;
  }
  return message || 'On-chain balance check failed';
}

export function redactRpcUrl(url: string): string {
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '(invalid rpc url)';
  }
}
