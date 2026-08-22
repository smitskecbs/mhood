// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleAdminBackfillRequest } from './adminBackfill.js';
import {
  KNOWN_BURNER_WALLET,
  KNOWN_MHOOD_BURN_SIGNATURES,
  MHOOD_BURN_MINT,
} from './knownMhoodBurns.js';
import { MemoryVerifiedBurnStore, UpstashVerifiedBurnStore } from './verifiedBurnStore.js';
import { SPL_TOKEN_PROGRAM_ID } from '../src/types/index.js';

const SIG_1 = KNOWN_MHOOD_BURN_SIGNATURES[0];
const SIG_2 = KNOWN_MHOOD_BURN_SIGNATURES[1];
const FORBIDDEN = /@solana\/web3\.js|rpc-websockets|@solana\/spl-token|new Connection\b/;

function parsedBurnTransaction(slot: number, blockTime: number) {
  return {
    slot,
    blockTime,
    transaction: {
      message: {
        instructions: [
          {
            program: 'spl-token',
            programId: SPL_TOKEN_PROGRAM_ID,
            parsed: {
              type: 'burnChecked',
              info: {
                mint: MHOOD_BURN_MINT,
                authority: KNOWN_BURNER_WALLET,
                tokenAmount: { amount: '1000000', decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: { err: null, innerInstructions: [] },
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockHeliusFetch(): typeof fetch {
  return (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      method?: string;
      params?: unknown[];
    };
    if (body.method === 'getSignaturesForAddress') {
      return jsonResponse({ result: [] });
    }
    if (body.method === 'getTransaction') {
      const signature = String(body.params?.[0] ?? '');
      if (signature === SIG_1) {
        return jsonResponse({ result: parsedBurnTransaction(440947761, 1787411161) });
      }
      if (signature === SIG_2) {
        return jsonResponse({ result: parsedBurnTransaction(440978846, 1787412000) });
      }
      return jsonResponse({ result: null });
    }
    return jsonResponse({ error: { message: `unexpected RPC ${body.method}` } }, 400);
  }) as typeof fetch;
}

function mockUpstashAndHeliusFetch(): typeof fetch {
  const data = new Map<string, string>();
  const helius = mockHeliusFetch();
  return (async (url, init) => {
    const href = String(url);
    if (href.includes('kv.example')) {
      const command = JSON.parse(String(init?.body ?? '[]')) as string[];
      const [op, , field, value] = command;
      if (op === 'HSETNX') {
        if (data.has(field!)) return jsonResponse({ result: 0 });
        data.set(field!, value!);
        return jsonResponse({ result: 1 });
      }
      if (op === 'HGET') return jsonResponse({ result: data.get(field!) ?? null });
      if (op === 'HVALS') return jsonResponse({ result: [...data.values()] });
      return jsonResponse({ result: null });
    }
    return helius(url, init);
  }) as typeof fetch;
}

function collectRelativeModules(entry: string, visited = new Set<string>()): string[] {
  const abs = path.resolve(entry);
  if (visited.has(abs) || !existsSync(abs)) return [...visited];
  visited.add(abs);
  const source = readFileSync(abs, 'utf8');
  const importRe = /from\s+['"](\.[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source))) {
    const spec = match[1]!;
    const dir = path.dirname(abs);
    const candidates = [
      spec,
      spec.replace(/\.js$/, '.ts'),
      `${spec}.ts`,
      path.join(spec, 'index.ts'),
    ].map((candidate) => path.resolve(dir, candidate));
    const next = candidates.find((candidate) => existsSync(candidate) && candidate.endsWith('.ts'));
    if (next) collectRelativeModules(next, visited);
  }
  return [...visited];
}

describe('admin burn backfill HTTP-only runtime', () => {
  it('does not pull @solana/web3.js, Connection, or rpc-websockets into the function graph', async () => {
    const files = collectRelativeModules(path.resolve(process.cwd(), 'api/admin/backfill-burns.ts'));
    expect(files.some((file) => file.replace(/\\/g, '/').endsWith('api/admin/backfill-burns.ts'))).toBe(true);
    expect(files.some((file) => file.includes('burnVerificationCore'))).toBe(true);
    expect(files.some((file) => /burnVerification\.ts$/.test(file.replace(/\\/g, '/')))).toBe(false);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(FORBIDDEN);
      expect(source, file).not.toMatch(/from ['"]@solana\/web3\.js['"]/);
    }

    const esbuild = await import('esbuild');
    const bundled = await esbuild.build({
      absWorkingDir: process.cwd(),
      entryPoints: ['api/admin/backfill-burns.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
      packages: 'external',
      logLevel: 'silent',
    });
    const code = bundled.outputFiles?.[0]?.text ?? '';
    expect(code).toMatch(/heliusRpc|getTransaction|getSignaturesForAddress/);
    expect(code).not.toMatch(/rpc-websockets/);
    expect(code).not.toMatch(/@solana\/web3\.js/);
    expect(code).not.toMatch(/@solana\/spl-token/);
  });

  it('loads the admin function without ERR_REQUIRE_ESM', async () => {
    const mod = await import('../api/admin/backfill-burns.js');
    expect(mod.GET).toEqual(expect.any(Function));
    expect(mod.POST).toEqual(expect.any(Function));
    const response = await mod.GET();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('GET does not crash the function', async () => {
    const result = await handleAdminBackfillRequest({ httpMethod: 'GET' });
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: 'Not found' });
  });

  it('POST without secret is rejected', async () => {
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: {},
      env: {
        BURN_BACKFILL_SECRET: 'forest-secret',
        HELIUS_RPC_URL: 'https://example.helius.invalid',
      },
    });
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: 'Not found' });
  });

  it('POST with secret and no Helius env returns a JSON error instead of crashing', async () => {
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: { BURN_BACKFILL_SECRET: 'forest-secret' },
    });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: 'Solana RPC endpoint is not configured.' });
  });

  it('POST with mocked Helius backfills both known signatures', async () => {
    const store = new MemoryVerifiedBurnStore();
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: {
        BURN_BACKFILL_SECRET: 'forest-secret',
        HELIUS_RPC_URL: 'https://example.helius.invalid',
      },
      store,
      fetchImpl: mockHeliusFetch(),
    });
    expect(result.status).toBe(200);
    const body = result.body as {
      ok: boolean;
      imported: number;
      records: Array<{ signature: string; wallet: string; amountUi: string; amountRaw: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.records.map((record) => record.signature).sort()).toEqual([SIG_1, SIG_2].sort());
    expect(body.records.every((record) => record.wallet === KNOWN_BURNER_WALLET)).toBe(true);
    expect(body.records.every((record) => record.amountRaw === '1000000')).toBe(true);
    expect(body.records.every((record) => record.amountUi === '1')).toBe(true);

    const stored = await store.list();
    expect(stored).toHaveLength(2);
    const burned = stored.reduce((total, record) => total + BigInt(record.amountRaw), 0n);
    expect(burned).toBe(2_000_000n);
    expect(new Set(stored.map((record) => record.wallet))).toEqual(new Set([KNOWN_BURNER_WALLET]));
  });

  it('stores verified records through an Upstash mock', async () => {
    const data = new Map<string, string>();
    const store = new UpstashVerifiedBurnStore(async (command) => {
      const [op, , field, value] = command;
      if (op === 'HSETNX') {
        if (data.has(field!)) return 0;
        data.set(field!, value!);
        return 1;
      }
      if (op === 'HGET') return data.get(field!) ?? null;
      if (op === 'HVALS') return [...data.values()];
      return null;
    });
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: {
        BURN_BACKFILL_SECRET: 'forest-secret',
        HELIUS_RPC_URL: 'https://example.helius.invalid',
      },
      store,
      fetchImpl: mockHeliusFetch(),
    });
    expect(result.status).toBe(200);
    expect((result.body as { imported: number }).imported).toBe(2);
    expect(await store.list()).toHaveLength(2);
    expect(data.size).toBe(2);
  });

  it('creates the KV/Upstash store from env and still backfills over HTTP fetch', async () => {
    const result = await handleAdminBackfillRequest({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer forest-secret' },
      env: {
        BURN_BACKFILL_SECRET: 'forest-secret',
        HELIUS_RPC_URL: 'https://example.helius.invalid',
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: 'kv-write-token',
      },
      fetchImpl: mockUpstashAndHeliusFetch(),
    });
    expect(result.status).toBe(200);
    expect((result.body as { imported: number; persistence: string }).imported).toBe(2);
    expect((result.body as { persistence: string }).persistence).toBe('persistent');
  });

  it('exported POST without a secret is a safe auth rejection', async () => {
    const { POST } = await import('../api/admin/backfill-burns.js');
    const response = await POST(new Request('http://localhost/api/admin/backfill-burns', { method: 'POST' }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });
});
