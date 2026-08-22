import { unpackMint } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { COPY } from '../../config/constants';
import { SPL_TOKEN_PROGRAM_ID } from '../../types';
import { formatHolderRpcError } from '../../utils/devLog';
import { HOLDER_MINT_RPC_METHOD, HolderVerificationError } from '../../utils/holderVerificationError';
import {
  decodeBase64AccountData,
  describeMintAccount,
  mintAccountInfoFromRpc,
  type RpcMintAccountValue,
} from './mintService';

const PRODUCTION_MINT_ACCOUNT: RpcMintAccountValue = {
  lamports: 1461600,
  data: [
    'AAAAAPZJZdnuqVil1THR5hztXOmdJYxUL18cg37WV1VY2ZycwD23pH6NAwAGAQAAAAD2SWXZ7qlYpdUx0eYc7VzpnSWMVC9fHIN+1ldVWNmcnA==',
    'base64',
  ],
  owner: SPL_TOKEN_PROGRAM_ID,
  executable: false,
  rentEpoch: 18446744073709552000,
  space: 82,
};

describe('mint account decoding', () => {
  it('reads a classic SPL mint from a transparent proxy getAccountInfo value', () => {
    const diagnostics = describeMintAccount(PRODUCTION_MINT_ACCOUNT);
    expect(diagnostics.ownerProgramId).toBe(SPL_TOKEN_PROGRAM_ID);
    expect(diagnostics.dataLength).toBe(82);
    expect(diagnostics.classicSplToken).toBe(true);

    const mint = new PublicKey('EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs');
    const info = mintAccountInfoFromRpc(PRODUCTION_MINT_ACCOUNT);
    expect(info.data.length).toBe(82);
    const state = unpackMint(mint, info, new PublicKey(SPL_TOKEN_PROGRAM_ID));
    expect(state.decimals).toBe(6);
  });

  it('reports invalid mint decode as a mint-read error, not RPC unavailable', () => {
    expect(() => decodeBase64AccountData({ program: 'spl-token', parsed: {} })).toThrow(/base64/i);

    const err = new HolderVerificationError({
      stage: 'mint-read',
      method: HOLDER_MINT_RPC_METHOD,
      message: 'Mint is not owned by a known token program: 11111111111111111111111111111111',
      details: describeMintAccount({
        owner: '11111111111111111111111111111111',
        data: ['', 'base64'],
        space: 0,
      }),
    });
    expect(err.stage).toBe('mint-read');
    expect(formatHolderRpcError(err).title).toBe(COPY.holderVerifyFailed);
    expect(formatHolderRpcError(err).detail).not.toBe(COPY.rpcUnavailableDetail);
    expect(err.details.classicSplToken).toBe(false);
    expect(err.details.ownerProgramId).toBe('11111111111111111111111111111111');
  });
});
