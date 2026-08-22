import { Buffer } from 'buffer';
import { unpackMint } from '@solana/spl-token';
import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID as TOKEN_2022_ID } from '../../types';
import type { MintDetails, TokenProgramKind } from '../../types';
import { appConfig, requireConfiguredRpcUrl, resolveMhoodMint } from '../../config/env';
import {
  HOLDER_MINT_RPC_METHOD,
  HolderVerificationError,
} from '../../utils/holderVerificationError';
import { formatTokenAmount } from '../../utils/tokenAmount';
import { totalBurnedFromSupply } from '../../utils/mhoodSupply';
import { postJsonRpc, unwrapRpcContextValue, type JsonRpcContextResult } from './jsonRpc';

export const CLASSIC_SPL_MINT_SIZE = 82;

let cachedMint: MintDetails | null = null;
let inFlightMint: Promise<MintDetails> | null = null;

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
  encoding?: string | null;
  dataTuple?: boolean;
  base64Length?: number | null;
};

export type Base64AccountDataTuple = {
  base64Data: string;
  encoding: string;
};

export function parseBase64AccountDataTuple(data: unknown): Base64AccountDataTuple {
  if (!Array.isArray(data) || data.length < 2 || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
    throw new Error('Mint account data is not a [base64, encoding] tuple');
  }
  return { base64Data: data[0], encoding: data[1] };
}

/** Browser-safe base64 → bytes. Do not pass the `[base64, encoding]` tuple into Buffer.from. */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export function decodeBase64AccountData(data: unknown): Uint8Array {
  const { base64Data, encoding } = parseBase64AccountDataTuple(data);
  if (encoding !== 'base64') {
    throw new Error(`Unsupported mint account encoding: ${encoding}`);
  }
  return decodeBase64ToBytes(base64Data);
}

export function assertClassicSplMintSize(byteLength: number): void {
  if (byteLength !== CLASSIC_SPL_MINT_SIZE) {
    throw new Error(`Unexpected classic SPL mint account size: ${byteLength} bytes`);
  }
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24);
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

export function decodeClassicSplMint(bytes: Uint8Array): {
  decimals: number;
  supplyRaw: bigint;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
} {
  assertClassicSplMintSize(bytes.byteLength);
  return {
    mintAuthorityRevoked: readU32LE(bytes, 0) === 0,
    supplyRaw: readU64LE(bytes, 36),
    decimals: bytes[44]!,
    freezeAuthorityRevoked: readU32LE(bytes, 46) === 0,
  };
}

export function describeMintAccount(account: RpcMintAccountValue | null): MintAccountDiagnostics {
  const ownerProgramId = typeof account?.owner === 'string' ? account.owner : null;
  let encoding: string | null = null;
  let dataTuple = false;
  let base64Length: number | null = null;
  let dataLength: number | null = typeof account?.space === 'number' ? account.space : null;
  try {
    const tuple = parseBase64AccountDataTuple(account?.data);
    encoding = tuple.encoding;
    dataTuple = true;
    base64Length = tuple.base64Data.length;
    dataLength = decodeBase64ToBytes(tuple.base64Data).byteLength;
  } catch {
    /* keep space-based length if the tuple cannot be read */
  }
  return {
    ownerProgramId,
    dataLength,
    classicSplToken: ownerProgramId === SPL_TOKEN_PROGRAM_ID && dataLength === CLASSIC_SPL_MINT_SIZE,
    decimals: null,
    encoding,
    dataTuple,
    base64Length,
  };
}

export function mintAccountInfoFromRpc(account: RpcMintAccountValue): AccountInfo<Buffer> {
  const bytes = decodeBase64AccountData(account.data);
  return {
    data: Buffer.from(bytes),
    executable: Boolean(account.executable),
    lamports: typeof account.lamports === 'number' ? account.lamports : 0,
    owner: new PublicKey(account.owner ?? ''),
    rentEpoch: typeof account.rentEpoch === 'number' ? account.rentEpoch : 0,
  };
}

function logMintAccountResponse(account: RpcMintAccountValue, bytes: Uint8Array, encoding: string): void {
  console.info('[MoginHood] mint account response', {
    owner: account.owner,
    executable: Boolean(account.executable),
    encoding,
    dataTuple: true,
    base64Length: parseBase64AccountDataTuple(account.data).base64Data.length,
    decodedByteLength: bytes.byteLength,
  });
}

function canonicalMintAddress(mintAddress: string): string {
  return resolveMhoodMint(mintAddress);
}

async function loadMintDetails(mintAddress: string): Promise<MintDetails> {
  requireConfiguredRpcUrl();
  const mint = canonicalMintAddress(mintAddress);

  const result = await postJsonRpc<JsonRpcContextResult<RpcMintAccountValue | null>>({
    method: HOLDER_MINT_RPC_METHOD,
    params: [mint, { encoding: 'base64', commitment: 'confirmed' }],
    stage: 'mint-read',
  });
  const account = unwrapRpcContextValue<RpcMintAccountValue | null>(
    result,
    'mint-read',
    HOLDER_MINT_RPC_METHOD,
  );

  if (!account || !account.owner) {
    throw new HolderVerificationError({
      stage: 'mint-read',
      method: HOLDER_MINT_RPC_METHOD,
      message: `Mint account not found: ${mint}`,
      details: describeMintAccount(account),
    });
  }

  let tokenProgramKind: TokenProgramKind;
  try {
    tokenProgramKind = kindFromOwner(account.owner);
  } catch (err) {
    throw HolderVerificationError.from(err, 'mint-read', HOLDER_MINT_RPC_METHOD, {
      details: describeMintAccount(account),
    });
  }

  let bytes: Uint8Array;
  let encoding: string;
  try {
    const tuple = parseBase64AccountDataTuple(account.data);
    encoding = tuple.encoding;
    if (encoding !== 'base64') {
      throw new Error(`Unsupported mint account encoding: ${encoding}`);
    }
    bytes = decodeBase64ToBytes(tuple.base64Data);
  } catch (err) {
    throw HolderVerificationError.from(err, 'mint-read', HOLDER_MINT_RPC_METHOD, {
      details: describeMintAccount(account),
    });
  }

  try {
    logMintAccountResponse(account, bytes, encoding);
  } catch {
    /* diagnostics must not fail mint-read */
  }

  const programId = programIdFromKind(tokenProgramKind);
  let decimals: number;
  let supplyRaw: bigint;
  let mintAuthorityRevoked: boolean;
  let freezeAuthorityRevoked: boolean;

  try {
    if (tokenProgramKind === 'spl-token') {
      assertClassicSplMintSize(bytes.byteLength);
      const decoded = decodeClassicSplMint(bytes);
      decimals = decoded.decimals;
      supplyRaw = decoded.supplyRaw;
      mintAuthorityRevoked = decoded.mintAuthorityRevoked;
      freezeAuthorityRevoked = decoded.freezeAuthorityRevoked;
    } else {
      const layoutMint = unpackMint(
        new PublicKey(mint),
        {
          data: Buffer.from(bytes),
          executable: Boolean(account.executable),
          lamports: typeof account.lamports === 'number' ? account.lamports : 0,
          owner: new PublicKey(account.owner),
          rentEpoch: typeof account.rentEpoch === 'number' ? account.rentEpoch : 0,
        },
        programId,
      );
      decimals = layoutMint.decimals;
      supplyRaw = layoutMint.supply;
      mintAuthorityRevoked = layoutMint.mintAuthority === null;
      freezeAuthorityRevoked = layoutMint.freezeAuthority === null;
    }
  } catch (err) {
    throw HolderVerificationError.from(err, 'mint-read', HOLDER_MINT_RPC_METHOD, {
      details: { ...describeMintAccount(account), dataLength: bytes.byteLength },
    });
  }

  try {
    console.info('[MoginHood] mint decoded', {
      program: tokenProgramKind === 'spl-token' ? 'classic SPL Token' : 'Token-2022',
      byteLength: bytes.byteLength,
      decimals,
    });
    console.info(`[MoginHood] current supply: ${formatTokenAmount(supplyRaw, decimals)}`);
    console.info(`[MoginHood] total burned: ${formatTokenAmount(totalBurnedFromSupply(supplyRaw), decimals)}`);
  } catch {
    /* diagnostics must not fail mint-read */
  }

  return {
    mint,
    decimals,
    supplyRaw,
    tokenProgramId: programId.toBase58(),
    tokenProgramKind,
    mintAuthorityRevoked,
    freezeAuthorityRevoked,
    space: bytes.byteLength,
  };
}

/**
 * Reads mint account owner + mint state from a single getAccountInfo JSON-RPC call.
 * Classic SPL mints are decoded from the 82-byte base64 payload only.
 */
export async function fetchMintDetails(
  _connection?: unknown,
  mintAddress = appConfig.mintAddress,
): Promise<MintDetails> {
  const mint = resolveMhoodMint(mintAddress);
  if (cachedMint && cachedMint.mint === mint) {
    return cachedMint;
  }
  if (inFlightMint) {
    return inFlightMint;
  }

  inFlightMint = loadMintDetails(mint)
    .then((details) => {
      cachedMint = details;
      return details;
    })
    .finally(() => {
      inFlightMint = null;
    });

  return inFlightMint;
}

export function clearMintCache(): void {
  cachedMint = null;
  inFlightMint = null;
}

export function getTokenProgramPublicKey(kind: TokenProgramKind): PublicKey {
  return programIdFromKind(kind);
}
