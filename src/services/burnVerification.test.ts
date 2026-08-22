import { describe, expect, it } from 'vitest';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  collectBurnCheckedInstructions,
  upsertVerifiedBurn,
  verifyExtractedBurns,
  BurnVerificationError,
} from './burnVerification';
import type { BurnRecord } from '../types';

const mint = 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs';
const wallet = '11111111111111111111111111111111';

function parsedBurn(amount: string) {
  return {
    transaction: {
      message: {
        instructions: [
          {
            program: 'spl-token',
            programId: TOKEN_PROGRAM_ID,
            parsed: {
              type: 'burnChecked',
              info: {
                mint,
                authority: wallet,
                tokenAmount: { amount, decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: { err: null, innerInstructions: [] },
  };
}

describe('burn verification', () => {
  it('accepts a confirmed BurnChecked of the expected amount', () => {
    const burns = collectBurnCheckedInstructions(parsedBurn('10000000000'));
    const verified = verifyExtractedBurns(burns, { mint, wallet, amountRaw: 10_000_000_000n });
    expect(verified.amountRaw).toBe(10_000_000_000n);
    expect(burns[0]?.decimals).toBe(6);
    expect(burns[0]?.tokenProgramId).toBe(TOKEN_PROGRAM_ID.toBase58());
  });

  it('rejects a missing, mismatched, or failed burn', () => {
    expect(() => verifyExtractedBurns([], { mint, wallet, amountRaw: 1n })).toThrow(BurnVerificationError);
    expect(() =>
      verifyExtractedBurns(collectBurnCheckedInstructions(parsedBurn('1')), {
        mint,
        wallet,
        amountRaw: 2n,
      }),
    ).toThrow(/does not match the prepared amount/);
    const wrongMint = collectBurnCheckedInstructions(parsedBurn('1'));
    expect(() =>
      verifyExtractedBurns(
        wrongMint.map((burn) => ({ ...burn, mint: 'other' })),
        { mint, wallet, amountRaw: 1n },
      ),
    ).toThrow(/mint/);
    expect(() =>
      verifyExtractedBurns(
        wrongMint.map((burn) => ({ ...burn, wallet: 'other' })),
        { mint, wallet, amountRaw: 1n },
      ),
    ).toThrow(/authority/);
  });

  it('decodes a compiled BurnChecked instruction when parsed JSON is missing', () => {
    const amount = 10_000_000_000n;
    const data = new Uint8Array(10);
    data[0] = 15;
    let remaining = amount;
    for (let i = 0; i < 8; i += 1) {
      data[1 + i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    data[9] = 6;
    const compiled = {
      programId: TOKEN_PROGRAM_ID.toBase58(),
      accounts: ['So11111111111111111111111111111111111111112', mint, wallet],
      data,
    };
    const burns = collectBurnCheckedInstructions({
      transaction: { message: { instructions: [compiled] } },
      meta: { err: null, innerInstructions: [] },
    });
    expect(burns[0]?.amountRaw).toBe(amount);
    expect(burns[0]?.mint).toBe(mint);
    expect(burns[0]?.wallet).toBe(wallet);
    expect(verifyExtractedBurns(burns, { mint, wallet, amountRaw: amount }).amountRaw).toBe(amount);
  });

  it('does not count the same signature twice', () => {
    const record: BurnRecord = {
      signature: 'sig-1',
      wallet,
      mint,
      amountRaw: '1000',
      amountUi: '0.001',
      slot: 1,
      timestamp: 1,
    };
    const first = upsertVerifiedBurn([], record);
    const second = upsertVerifiedBurn(first.records, record);
    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.records).toHaveLength(1);
  });
});
