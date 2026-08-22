import { unpackMint } from '@solana/spl-token';
import { PublicKey, type Connection } from '@solana/web3.js';
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID as TOKEN_2022_ID } from '../../types';
import type { MintDetails, TokenProgramKind } from '../../types';
import { appConfig, requireConfiguredRpcUrl } from '../../config/env';
import { getConnection } from './connection';

let cachedMint: MintDetails | null = null;

function kindFromOwner(owner: string): TokenProgramKind {
  if (owner === TOKEN_2022_ID) return 'token-2022';
  if (owner === SPL_TOKEN_PROGRAM_ID) return 'spl-token';
  throw new Error(`Mint is not owned by a known token program: ${owner}`);
}

function programIdFromKind(kind: TokenProgramKind) {
  return new PublicKey(kind === 'token-2022' ? TOKEN_2022_ID : SPL_TOKEN_PROGRAM_ID);
}

/**
 * Reads mint account owner + parsed mint state from a single getAccountInfo.
 * Decimals, program, and authorities come from chain — never from a hardcoded guess.
 */
export async function fetchMintDetails(
  connection: Connection = getConnection(),
  mintAddress = appConfig.mintAddress,
): Promise<MintDetails> {
  requireConfiguredRpcUrl();
  if (cachedMint && cachedMint.mint === mintAddress) {
    return cachedMint;
  }

  const mint = new PublicKey(mintAddress);
  const account = await connection.getAccountInfo(mint, 'confirmed');
  if (!account) {
    throw new Error(`Mint account not found: ${mintAddress}`);
  }

  const tokenProgramKind = kindFromOwner(account.owner.toBase58());
  const programId = programIdFromKind(tokenProgramKind);
  const mintState = unpackMint(mint, account, programId);

  cachedMint = {
    mint: mintAddress,
    decimals: mintState.decimals,
    supplyRaw: mintState.supply,
    tokenProgramId: programId.toBase58(),
    tokenProgramKind,
    mintAuthorityRevoked: mintState.mintAuthority === null,
    freezeAuthorityRevoked: mintState.freezeAuthority === null,
    space: account.data.length,
  };

  return cachedMint;
}

export function clearMintCache(): void {
  cachedMint = null;
}

export function getTokenProgramPublicKey(kind: TokenProgramKind): PublicKey {
  return programIdFromKind(kind);
}
