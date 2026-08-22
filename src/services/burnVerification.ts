import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TokenInstruction,
  decodeBurnCheckedInstructionUnchecked,
} from '@solana/spl-token';
import { PublicKey, TransactionInstruction, type Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID as TOKEN_2022_ID } from '../types/index.js';
import { formatTokenAmount } from '../utils/tokenAmount.js';
import type { BurnRecord } from '../types/index.js';

export type BurnVerificationExpectation = {
  mint: string;
  wallet: string;
  amountRaw: bigint;
};

export type ExtractedBurnChecked = {
  mint: string;
  wallet: string;
  amountRaw: bigint;
  decimals: number;
  tokenProgramId: string;
};

export class BurnVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BurnVerificationError';
  }
}

const TOKEN_PROGRAMS = new Set([
  TOKEN_PROGRAM_ID.toBase58(),
  TOKEN_2022_PROGRAM_ID.toBase58(),
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_ID,
]);

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function programIdString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof PublicKey) return value.toBase58();
  if (typeof value === 'object' && 'toBase58' in value && typeof value.toBase58 === 'function') {
    return (value as PublicKey).toBase58();
  }
  return String(value);
}

function parseAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

export function decodeBase58Bytes(value: string): Uint8Array | null {
  if (!value) return null;
  try {
    const bytes: number[] = [0];
    for (const char of value) {
      const digit = BASE58_ALPHABET.indexOf(char);
      if (digit < 0) return null;
      let carry = digit;
      for (let i = 0; i < bytes.length; i += 1) {
        carry += bytes[i]! * 58;
        bytes[i] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    let leading = 0;
    for (const char of value) {
      if (char !== '1') break;
      leading += 1;
    }
    const decoded = new Uint8Array(leading + bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      decoded[decoded.length - 1 - i] = bytes[i]!;
    }
    return decoded;
  } catch {
    return null;
  }
}

function instructionDataBytes(data: unknown): Buffer | null {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (Array.isArray(data) && data.every((item) => typeof item === 'number')) {
    return Buffer.from(data);
  }
  if (typeof data === 'string') {
    const decoded = decodeBase58Bytes(data);
    return decoded ? Buffer.from(decoded) : null;
  }
  return null;
}

function accountPublicKey(value: unknown): PublicKey | null {
  try {
    if (!value) return null;
    if (value instanceof PublicKey) return value;
    if (typeof value === 'string') return new PublicKey(value);
    if (typeof value === 'object' && 'pubkey' in value) {
      return accountPublicKey((value as { pubkey: unknown }).pubkey);
    }
    if (typeof value === 'object' && 'toBase58' in value && typeof value.toBase58 === 'function') {
      return new PublicKey((value as PublicKey).toBase58());
    }
  } catch {
    return null;
  }
  return null;
}

export function extractBurnCheckedFromParsedInstruction(instruction: unknown): ExtractedBurnChecked | null {
  if (!instruction || typeof instruction !== 'object') return null;
  const value = instruction as { programId?: unknown; parsed?: unknown };
  const programId = programIdString(value.programId);
  if (programId && !TOKEN_PROGRAMS.has(programId)) return null;

  if (!value.parsed || typeof value.parsed !== 'object') {
    return null;
  }

  const parsed = value.parsed as { type?: string; info?: Record<string, unknown> };
  if (parsed.type !== 'burnChecked' && parsed.type !== 'burn') return null;
  const info = parsed.info ?? {};
  const tokenAmount = (info.tokenAmount ?? {}) as { amount?: unknown; decimals?: unknown };
  const amountRaw = parseAmount(tokenAmount.amount ?? info.amount);
  const mint = typeof info.mint === 'string' ? info.mint : programIdString(info.mint);
  const wallet = typeof info.authority === 'string' ? info.authority : programIdString(info.authority);
  const decimals = typeof tokenAmount.decimals === 'number' ? tokenAmount.decimals : Number(info.decimals);
  if (!mint || !wallet || amountRaw === null || !Number.isInteger(decimals)) return null;

  return {
    mint,
    wallet,
    amountRaw,
    decimals,
    tokenProgramId: programId || SPL_TOKEN_PROGRAM_ID,
  };
}

export function extractBurnCheckedFromCompiledInstruction(instruction: unknown): ExtractedBurnChecked | null {
  if (!instruction || typeof instruction !== 'object') return null;
  const value = instruction as {
    programId?: unknown;
    program?: unknown;
    accounts?: unknown;
    keys?: unknown;
    data?: unknown;
    parsed?: unknown;
  };
  if (value.parsed) return null;

  const programId = programIdString(value.programId || value.program);
  if (!programId || !TOKEN_PROGRAMS.has(programId)) return null;
  const data = instructionDataBytes(value.data);
  if (!data) return null;

  const accountSource = Array.isArray(value.keys)
    ? value.keys
    : Array.isArray(value.accounts)
      ? value.accounts
      : [];
  const keys = accountSource
    .map((account) => {
      const pubkey = accountPublicKey(account);
      return pubkey
        ? {
            pubkey,
            isSigner: Boolean((account as { isSigner?: boolean }).isSigner),
            isWritable: Boolean((account as { isWritable?: boolean }).isWritable),
          }
        : null;
    })
    .filter((key): key is { pubkey: PublicKey; isSigner: boolean; isWritable: boolean } => Boolean(key));

  if (keys.length < 3) return null;

  try {
    const decoded = decodeBurnCheckedInstructionUnchecked(
      new TransactionInstruction({
        programId: new PublicKey(programId),
        keys,
        data,
      }),
    );
    if (decoded.data.instruction !== TokenInstruction.BurnChecked) return null;
    const mint = decoded.keys.mint?.pubkey.toBase58() ?? '';
    const wallet = decoded.keys.owner?.pubkey.toBase58() ?? '';
    if (!mint || !wallet) return null;
    return {
      mint,
      wallet,
      amountRaw: decoded.data.amount,
      decimals: decoded.data.decimals,
      tokenProgramId: programId,
    };
  } catch {
    return null;
  }
}

export function extractBurnCheckedInstruction(instruction: unknown): ExtractedBurnChecked | null {
  return (
    extractBurnCheckedFromParsedInstruction(instruction) ??
    extractBurnCheckedFromCompiledInstruction(instruction)
  );
}

export function collectBurnCheckedInstructions(payload: {
  transaction?: { message?: { instructions?: readonly unknown[] } };
  meta?: {
    err?: unknown;
    innerInstructions?: readonly { instructions?: readonly unknown[] }[] | null;
  } | null;
}): ExtractedBurnChecked[] {
  const found: ExtractedBurnChecked[] = [];
  const outer = payload.transaction?.message?.instructions ?? [];
  for (const instruction of outer) {
    const extracted = extractBurnCheckedInstruction(instruction);
    if (extracted) found.push(extracted);
  }
  for (const inner of payload.meta?.innerInstructions ?? []) {
    for (const instruction of inner.instructions ?? []) {
      const extracted = extractBurnCheckedInstruction(instruction);
      if (extracted) found.push(extracted);
    }
  }
  return found;
}

export function verifyExtractedBurns(
  burns: ExtractedBurnChecked[],
  expected: BurnVerificationExpectation,
): { amountRaw: bigint; wallet: string; mint: string } {
  if (burns.length === 0) {
    throw new BurnVerificationError('Transaction does not contain a MHOOD BurnChecked instruction.');
  }

  let total = 0n;
  for (const burn of burns) {
    if (burn.mint !== expected.mint) {
      throw new BurnVerificationError('BurnChecked mint does not match MHOOD.');
    }
    if (burn.wallet !== expected.wallet) {
      throw new BurnVerificationError('BurnChecked authority does not match the connected wallet.');
    }
    total += burn.amountRaw;
  }

  if (total !== expected.amountRaw) {
    throw new BurnVerificationError('Verified burn amount does not match the prepared amount.');
  }

  return { amountRaw: total, wallet: expected.wallet, mint: expected.mint };
}

export function toBurnRecord(input: {
  signature: string;
  wallet: string;
  mint: string;
  amountRaw: bigint;
  decimals: number;
  slot: number;
  timestamp: number | null;
}): BurnRecord {
  return {
    signature: input.signature,
    wallet: input.wallet,
    mint: input.mint,
    amountRaw: input.amountRaw.toString(),
    amountUi: formatTokenAmount(input.amountRaw, input.decimals),
    slot: input.slot,
    timestamp: input.timestamp,
  };
}

async function fetchParsedTransaction(
  connection: Connection,
  signature: string,
  attempts = 8,
): Promise<NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>> {
  let last: Awaited<ReturnType<Connection['getParsedTransaction']>> = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (!last) {
    throw new BurnVerificationError('The forest could not confirm the burn.');
  }
  return last;
}

export async function confirmAndVerifyBurn(
  connection: Connection,
  signature: string,
  expected: BurnVerificationExpectation,
  decimals: number,
): Promise<BurnRecord> {
  const parsed = await fetchParsedTransaction(connection, signature);
  if (parsed.meta?.err) {
    throw new BurnVerificationError('The burn transaction failed on-chain.');
  }

  const burns = collectBurnCheckedInstructions({
    transaction: parsed.transaction,
    meta: parsed.meta,
  });
  const verified = verifyExtractedBurns(burns, expected);
  return toBurnRecord({
    signature,
    wallet: verified.wallet,
    mint: verified.mint,
    amountRaw: verified.amountRaw,
    decimals,
    slot: parsed.slot,
    timestamp: parsed.blockTime ?? null,
  });
}

export function upsertVerifiedBurn(
  records: BurnRecord[],
  next: BurnRecord,
): { records: BurnRecord[]; added: boolean } {
  if (records.some((record) => record.signature === next.signature)) {
    return { records, added: false };
  }
  return { records: [...records, next], added: true };
}
