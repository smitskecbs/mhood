import { Buffer } from 'buffer';
import { unpackMint } from '@solana/spl-token';
import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID as TOKEN_2022_ID } from '../../types';
import type { MintDetails, TokenProgramKind } from '../../types';
import { appConfig, requireConfiguredRpcUrl } from '../../config/env';
import {
  HOLDER_MINT_RPC_METHOD,
  HolderVerificationError,
} from '../../utils/holderVerificationError';
import { postJsonRpc, unwrapRpcContextValue, type JsonRpcContextResult } from './jsonRpc';

let cachedMint: MintDetails | null = null;

function kindFromOwner(owner: string): TokenProgramKind {
  if (owner === TOKEN_2022_ID) return 'token-2022';
  if (owner === SPL_TOKEN_PROGRAM_ID) return 'spl-token';
  throw new Error(`Mint is not owned by a known token program: ${owner}`);
}

function programIdFromKind(kind: TokenProgramKind) {
  return new PublicKey(kind === 'token-2022' ? TOKEN_2022_ID : SPL_TOKEN_PROGRAM_ID);
}

export type RpcMintAccountValue = {
  lamports?: number;
  owner?: string;
  data?: unknown;
  executable?: boolean;
  rentEpoch?: number;
  space?: number;
};

export type MintAccountDiagnostics = {
  ownerProgramId: string | null;
  dataLength: number | null;
  classicSplToken: boolean;
  decimals: number | null;
};

export function decodeBase64AccountData(data: unknown): Buffer {
  if (Array.isArray(data) && typeof data[0] === 'string') {
    return Buffer.from(data[0], 'base64');
  }
  throw new Error('Mint account data is not base64');
}

export function describeMintAccount(account: RpcMintAccountValue | null): MintAccountDiagnostics {
  const ownerProgramId = typeof account?.owner === 'string' ? account.owner : null;
  let dataLength: number | null = typeof account?.space === 'number' ? account.space : null;
  if (dataLength == null && account) {
    try {
      dataLength = decodeBase64AccountData(account.data).length;
    } catch {
      dataLength = null;
    }
  }
  return {
    ownerProgramId,
    dataLength,
    classicSplToken: ownerProgramId === SPL_TOKEN_PROGRAM_ID && dataLength === 82,
    decimals: null,
  };
}

export function mintAccountInfoFromRpc(account: RpcMintAccountValue): AccountInfo<Buffer> {
  return {
    data: decodeBase64AccountData(account.data),
    executable: Boolean(account.executable),
    lamports: typeof account.lamports === 'number' ? account.lamports : 0,
    owner: new PublicKey(account.owner ?? ''),
    rentEpoch: typeof account.rentEpoch === 'number' ? account.rentEpoch : 0,
  };
}

/**
 * Reads mint account owner + mint state from a single getAccountInfo JSON-RPC call.
 * Decimals, program, and authorities come from chain — never from a hardcoded guess.
 */
export async function fetchMintDetails(
  _connection?: unknown,
  mintAddress = appConfig.mintAddress,
): Promise<MintDetails> {
  requireConfiguredRpcUrl();
  if (cachedMint && cachedMint.mint === mintAddress) {
    return cachedMint;
  }

  const result = await postJsonRpc<JsonRpcContextResult<RpcMintAccountValue | null>>({
    method: HOLDER_MINT_RPC_METHOD,
    params: [mintAddress, { encoding: 'base64', commitment: 'confirmed' }],
    stage: 'mint-read',
  });
  const account = unwrapRpcContextValue<RpcMintAccountValue | null>(
    result,
    'mint-read',
    HOLDER_MINT_RPC_METHOD,
  );
  const diagnostics = describeMintAccount(account);

  if (!account || !account.owner) {
    throw new HolderVerificationError({
      stage: 'mint-read',
      method: HOLDER_MINT_RPC_METHOD,
      message: `Mint account not found: ${mintAddress}`,
      details: diagnostics,
    });
  }

  let tokenProgramKind: TokenProgramKind;
  try {
    tokenProgramKind = kindFromOwner(account.owner);
  } catch (err) {
    throw HolderVerificationError.from(err, 'mint-read', HOLDER_MINT_RPC_METHOD, { details: diagnostics });
  }

  const mint = new PublicKey(mintAddress);
  const programId = programIdFromKind(tokenProgramKind);
    const accountInfo = mintAccountInfoFromRpc(account);
  let mintState;
  try {
    mintState = unpackMint(mint, accountInfo, programId);
  } catch (err) {
    throw HolderVerificationError.from(err, 'mint-read', HOLDER_MINT_RPC_METHOD, {
      details: diagnostics,
    });
  }

  cachedMint = {
    mint: mintAddress,
    decimals: mintState.decimals,
    supplyRaw: mintState.supply,
    tokenProgramId: programId.toBase58(),
    tokenProgramKind,
    mintAuthorityRevoked: mintState.mintAuthority === null,
    freezeAuthorityRevoked: mintState.freezeAuthority === null,
    space: accountInfo.data.length,
  };

  return cachedMint;
}

export function clearMintCache(): void {
  cachedMint = null;
}

export function getTokenProgramPublicKey(kind: TokenProgramKind): PublicKey {
  return programIdFromKind(kind);
}
