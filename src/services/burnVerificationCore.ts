/** Server-safe BurnChecked parsing. HTTP JSON-RPC only — no websocket client stack. */
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../types/index.js';
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

const TOKEN_PROGRAMS = new Set([SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]);
const BURN_CHECKED_INSTRUCTION = 15;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function programIdString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toBase58' in value && typeof (value as { toBase58?: unknown }).toBase58 === 'function') {
    return (value as { toBase58: () => string }).toBase58();
  }
  if (typeof value === 'object' && 'pubkey' in value) {
    return programIdString((value as { pubkey: unknown }).pubkey);
  }
  return '';
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

function instructionDataBytes(data: unknown): Uint8Array | null {
  if (!data) return null;
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data) && data.every((item) => typeof item === 'number')) {
    return Uint8Array.from(data);
  }
  if (typeof data === 'string') return decodeBase58Bytes(data);
  return null;
}

function accountPublicKeyString(value: unknown): string {
  return programIdString(value);
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value |= BigInt(bytes[offset + i] ?? 0) << BigInt(8 * i);
  }
  return value;
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
  if (!data || data.length < 10 || data[0] !== BURN_CHECKED_INSTRUCTION) return null;

  const accountSource = Array.isArray(value.keys)
    ? value.keys
    : Array.isArray(value.accounts)
      ? value.accounts
      : [];
  const accounts = accountSource.map((account) => accountPublicKeyString(account)).filter(Boolean);
  if (accounts.length < 3) return null;

  const mint = accounts[1] ?? '';
  const wallet = accounts[2] ?? '';
  if (!mint || !wallet) return null;

  return {
    mint,
    wallet,
    amountRaw: readU64LE(data, 1),
    decimals: data[9] ?? 0,
    tokenProgramId: programId,
  };
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

export function extractVerifiedMhoodBurnRecord(input: {
  signature: string;
  parsed: {
    slot: number;
    blockTime?: number | null;
    transaction?: { message?: { instructions?: readonly unknown[] } };
    meta?: {
      err?: unknown;
      innerInstructions?: readonly { instructions?: readonly unknown[] }[] | null;
    } | null;
  };
  mint: string;
  decimals: number;
  expectedWallet?: string;
}): BurnRecord {
  if (input.parsed.meta?.err) {
    throw new BurnVerificationError('The burn transaction failed on-chain.');
  }

  const burns = collectBurnCheckedInstructions({
    transaction: input.parsed.transaction,
    meta: input.parsed.meta,
  });
  const mhoodBurns = burns.filter((burn) => burn.mint === input.mint);
  if (mhoodBurns.length === 0) {
    if (burns.length > 0) {
      throw new BurnVerificationError('BurnChecked mint does not match MHOOD.');
    }
    throw new BurnVerificationError('Transaction does not contain a MHOOD BurnChecked instruction.');
  }

  const wallets = new Set(mhoodBurns.map((burn) => burn.wallet));
  const wallet = mhoodBurns[0]?.wallet ?? '';
  if (!wallet || wallets.size !== 1) {
    throw new BurnVerificationError('BurnChecked authority does not match the connected wallet.');
  }
  if (input.expectedWallet && wallet !== input.expectedWallet) {
    throw new BurnVerificationError('BurnChecked authority does not match the connected wallet.');
  }

  const amountRaw = mhoodBurns.reduce((total, burn) => total + burn.amountRaw, 0n);
  return toBurnRecord({
    signature: input.signature,
    wallet,
    mint: input.mint,
    amountRaw,
    decimals: input.decimals,
    slot: input.parsed.slot,
    timestamp: input.parsed.blockTime ?? null,
  });
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

export function upsertVerifiedBurn(
  records: BurnRecord[],
  next: BurnRecord,
): { records: BurnRecord[]; added: boolean } {
  if (records.some((record) => record.signature === next.signature)) {
    return { records, added: false };
  }
  return { records: [...records, next], added: true };
}
