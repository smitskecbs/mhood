import { requireConfiguredRpcUrl } from '../../config/env';
import { HOLDER_RANKING_MAX_PAGES, HOLDER_RANKING_PAGE_SIZE } from '../../config/timing';
import { devLog } from '../../utils/devLog';
import { normalizeMintTokenAccount, type MintTokenAccountRow } from '../../utils/holderAggregation';

export type HeliusTokenAccountsPage = {
  token_accounts?: Array<{
    address?: string;
    owner?: string;
    amount?: string | number;
    burnt?: boolean;
  }>;
  cursor?: string;
  total?: number;
  limit?: number;
};

export type DasRpcRequest = (method: string, params: Record<string, unknown>) => Promise<HeliusTokenAccountsPage>;

async function defaultDasRpc(method: string, params: Record<string, unknown>): Promise<HeliusTokenAccountsPage> {
  const url = requireConfiguredRpcUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'moginhood-holders',
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`Holder ranking RPC returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: HeliusTokenAccountsPage;
  };
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  if (!payload.result) {
    throw new Error('Holder ranking RPC returned an empty result');
  }
  return payload.result;
}

export async function fetchAllMintTokenAccounts(options: {
  mint: string;
  request?: DasRpcRequest;
  pageSize?: number;
  maxPages?: number;
}): Promise<MintTokenAccountRow[]> {
  const request = options.request ?? defaultDasRpc;
  const pageSize = options.pageSize ?? HOLDER_RANKING_PAGE_SIZE;
  const maxPages = options.maxPages ?? HOLDER_RANKING_MAX_PAGES;
  const accounts: MintTokenAccountRow[] = [];
  const seen = new Set<string>();
  let page = 1;
  let cursor: string | undefined;

  while (page <= maxPages) {
    const params: Record<string, unknown> = {
      mint: options.mint,
      limit: pageSize,
      page,
      options: { showZeroBalance: false },
    };
    if (cursor) params.cursor = cursor;

    const result = await request('getTokenAccounts', params);
    const rows = result.token_accounts ?? [];
    devLog(`holder ranking page ${page}: ${rows.length} accounts`);

    if (rows.length === 0) break;

    let added = 0;
    for (const row of rows) {
      const normalized = normalizeMintTokenAccount(row);
      if (!normalized || seen.has(normalized.address)) continue;
      seen.add(normalized.address);
      accounts.push(normalized);
      added += 1;
    }

    const nextCursor = typeof result.cursor === 'string' && result.cursor.length > 0 ? result.cursor : undefined;
    const sameCursor = Boolean(cursor && nextCursor && cursor === nextCursor);
    cursor = nextCursor;

    if (rows.length < pageSize || added === 0 || sameCursor) break;
    page += 1;
  }

  if (page > maxPages) {
    throw new Error('Holder ranking pagination exceeded the safety page limit');
  }

  return accounts;
}
