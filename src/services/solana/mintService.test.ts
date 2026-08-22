import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPY } from '../../config/constants';
import { SPL_TOKEN_PROGRAM_ID } from '../../types';
import { formatHolderRpcError } from '../../utils/devLog';
import { HOLDER_MINT_RPC_METHOD, HolderVerificationError } from '../../utils/holderVerificationError';
import {
  CLASSIC_SPL_MINT_SIZE,
  assertClassicSplMintSize,
  clearMintCache,
  decodeBase64AccountData,
  decodeBase64ToBytes,
  decodeClassicSplMint,
  describeMintAccount,
  fetchMintDetails,
  parseBase64AccountDataTuple,
  type RpcMintAccountValue,
} from './mintService';

const PRODUCTION_BASE64 =
  'AAAAAPZJZdnuqVil1THR5hztXOmdJYxUL18cg37WV1VY2ZycwD23pH6NAwAGAQAAAAD2SWXZ7qlYpdUx0eYc7VzpnSWMVC9fHIN+1ldVWNmcnA==';

const PRODUCTION_MINT_ACCOUNT: RpcMintAccountValue = {
  lamports: 1461600,
  data: [PRODUCTION_BASE64, 'base64'],
  owner: SPL_TOKEN_PROGRAM_ID,
  executable: false,
  rentEpoch: 18446744073709552000,
  space: 82,
};

const PRODUCTION_GET_ACCOUNT_INFO = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    context: { slot: 440968758, apiVersion: '4.3.0-alpha.2' },
    value: PRODUCTION_MINT_ACCOUNT,
  },
};

describe('mint account decoding', () => {
  afterEach(() => {
    clearMintCache();
  });

  it('reads only data[0] from a production [base64, encoding] tuple', () => {
    const tuple = parseBase64AccountDataTuple(PRODUCTION_MINT_ACCOUNT.data);
    expect(tuple.encoding).toBe('base64');
    expect(tuple.base64Data).toBe(PRODUCTION_BASE64);

    const decoded = decodeBase64AccountData(PRODUCTION_MINT_ACCOUNT.data);
    expect(decoded.byteLength).toBe(CLASSIC_SPL_MINT_SIZE);
    expect(decoded).toEqual(decodeBase64ToBytes(PRODUCTION_BASE64));

    const wronglyFromTuple = Buffer.from(PRODUCTION_MINT_ACCOUNT.data as unknown as string);
    expect(wronglyFromTuple.length).not.toBe(CLASSIC_SPL_MINT_SIZE);
  });

  it('requires classic SPL mint accounts to be 82 bytes', () => {
    const bytes = decodeBase64AccountData(PRODUCTION_MINT_ACCOUNT.data);
    expect(bytes.byteLength).toBe(82);
    expect(() => assertClassicSplMintSize(bytes.byteLength)).not.toThrow();
    expect(() => assertClassicSplMintSize(80)).toThrow('Unexpected classic SPL mint account size: 80 bytes');
    expect(() => decodeClassicSplMint(new Uint8Array(165))).toThrow(
      'Unexpected classic SPL mint account size: 165 bytes',
    );
  });

  it('accepts Tokenkeg owner and decodes decimals 6 without WrongSize', () => {
    const diagnostics = describeMintAccount(PRODUCTION_MINT_ACCOUNT);
    expect(diagnostics.ownerProgramId).toBe(SPL_TOKEN_PROGRAM_ID);
    expect(diagnostics.classicSplToken).toBe(true);
    expect(diagnostics.encoding).toBe('base64');
    expect(diagnostics.dataTuple).toBe(true);

    const decoded = decodeClassicSplMint(decodeBase64AccountData(PRODUCTION_MINT_ACCOUNT.data));
    expect(decoded.decimals).toBe(6);
    expect(() => decodeClassicSplMint(decodeBase64AccountData(PRODUCTION_MINT_ACCOUNT.data))).not.toThrow(
      /WrongSize/,
    );
  });

  it('decodes a transparent production getAccountInfo value', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => PRODUCTION_GET_ACCOUNT_INFO,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    try {
      const details = await fetchMintDetails(
        undefined,
        'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
      );
      const [, init] = fetchImpl.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(init.body) as { method: string; params: unknown[] };
      expect(body.method).toBe(HOLDER_MINT_RPC_METHOD);
      expect(body.params[0]).toBe('EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs');
      expect(body.params[1]).toMatchObject({ encoding: 'base64' });
      expect(details.tokenProgramKind).toBe('spl-token');
      expect(details.tokenProgramId).toBe(SPL_TOKEN_PROGRAM_ID);
      expect(details.space).toBe(82);
      expect(details.decimals).toBe(6);
      expect(details.mint).toBe('EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports invalid mint decode as a mint-read error, not RPC unavailable', () => {
    expect(() => decodeBase64AccountData({ program: 'spl-token', parsed: {} })).toThrow(/tuple/i);

    const err = new HolderVerificationError({
      stage: 'mint-read',
      method: HOLDER_MINT_RPC_METHOD,
      message: 'Unexpected classic SPL mint account size: 12 bytes',
      details: describeMintAccount({
        owner: '11111111111111111111111111111111',
        data: ['AAAA', 'base64'],
        space: 12,
      }),
    });
    expect(err.stage).toBe('mint-read');
    expect(err.message).not.toMatch(/WrongSize/);
    expect(formatHolderRpcError(err).title).toBe(COPY.holderVerifyFailed);
    expect(new PublicKey(SPL_TOKEN_PROGRAM_ID).toBase58()).toBe(SPL_TOKEN_PROGRAM_ID);
  });
});
