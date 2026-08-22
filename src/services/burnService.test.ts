// @vitest-environment node
import { TOKEN_PROGRAM_ID, decodeBurnCheckedInstruction } from '@solana/spl-token';
import { PublicKey, type Connection, type Transaction } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MintDetails, WalletMhoodBalance } from '../types';
import { parseRealBurnFlag } from '../config/env';

const flags = vi.hoisted(() => ({ real: false }));

vi.mock('../config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/env')>();
  return {
    ...actual,
    isRealBurnEnabled: () => flags.real,
  };
});

import {
  assertBurnSafety,
  buildBurnInstructions,
  buildBurnTransaction,
  executePreparedBurn,
  formatBurnUserError,
  prepareBurn,
  RealBurnDisabledError,
  shouldRefreshAfterVerifiedBurn,
  submitAndVerifyBurn,
  walletCanSendTransactions,
} from './burnService';
import { BurnVerificationError } from './burnVerification';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1_000_000_000_000_000n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

const wallet = '11111111111111111111111111111111';

const balance: WalletMhoodBalance = {
  wallet,
  mint: mint.mint,
  decimals: 6,
  tokenProgramKind: 'spl-token',
  totalRaw: 4_820_000_000_000n,
  accounts: [{ address: new PublicKey(1).toBase58(), amountRaw: 4_820_000_000_000n }],
  meetsAccessThreshold: true,
  fetchedAt: Date.now(),
};

function parsedBurnTx(amount: string) {
  return {
    slot: 99,
    blockTime: 1_700_000_000,
    meta: { err: null, innerInstructions: [] },
    transaction: {
      message: {
        instructions: [
          {
            program: 'spl-token',
            programId: TOKEN_PROGRAM_ID,
            parsed: {
              type: 'burnChecked',
              info: {
                mint: mint.mint,
                authority: wallet,
                tokenAmount: { amount, decimals: 6 },
              },
            },
          },
        ],
      },
    },
  };
}

function mockConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    getLatestBlockhash: async () => ({ blockhash: 'blockhash-1', lastValidBlockHeight: 123 }),
    confirmTransaction: async () => ({ value: { err: null } }),
    getSignatureStatuses: async () => ({ value: [{ confirmationStatus: 'confirmed', err: null }] }),
    getParsedTransaction: async () => parsedBurnTx('250000000000'),
    ...overrides,
  } as unknown as Connection;
}

describe('burnService safety', () => {
  beforeEach(() => {
    flags.real = false;
  });

  it('keeps real burns disabled by default', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(flags.real).toBe(false);
  });

  it('prepares a simulation burn and does not mark it as a real send', () => {
    assertBurnSafety(mint, 250_000_000_000n, balance);
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    expect(prepared.mode).toBe('simulation');
    expect(prepared.amountUi).toBe('250,000');
    expect(prepared.instructionCount).toBe(1);
    expect(prepared.allocations[0]?.amountRaw).toBe(250_000_000_000n);
  });

  it('builds BurnChecked instructions for the MHOOD mint and token program', () => {
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: [
        { address: new PublicKey(1).toBase58(), amountRaw: 7_000_000_000n },
        { address: new PublicKey(2).toBase58(), amountRaw: 8_000_000_000n },
      ],
      amountRaw: 10_000_000_000n,
    });
    const instructions = buildBurnInstructions(prepared);
    expect(instructions).toHaveLength(2);
    const first = decodeBurnCheckedInstruction(instructions[0]!, TOKEN_PROGRAM_ID);
    expect(first.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(first.keys.mint.pubkey.toBase58()).toBe(mint.mint);
    expect(first.keys.owner.pubkey.toBase58()).toBe(wallet);
    expect(first.data.decimals).toBe(6);
    expect(first.data.amount).toBe(7_000_000_000n);
    expect(decodeBurnCheckedInstruction(instructions[1]!, TOKEN_PROGRAM_ID).data.amount).toBe(3_000_000_000n);
  });

  it('sets feePayer and a recent blockhash on the built transaction', async () => {
    flags.real = true;
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    const built = await buildBurnTransaction(prepared, mockConnection());
    expect(built.transaction.feePayer?.toBase58()).toBe(wallet);
    expect(built.transaction.recentBlockhash).toBe('blockhash-1');
    expect(built.lastValidBlockHeight).toBe(123);
    expect(built.transaction.instructions).toHaveLength(1);
  });

  it('refuses to send a real burn while the flag is false', async () => {
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    await expect(
      executePreparedBurn({
        prepared,
        sendTransaction: async () => {
          throw new Error('sendTransaction must not be called in simulation mode');
        },
      }),
    ).rejects.toBeInstanceOf(RealBurnDisabledError);
    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: {
          sendTransaction: async () => {
            throw new Error('sendTransaction must not be called in simulation mode');
          },
        },
      }),
    ).rejects.toBeInstanceOf(RealBurnDisabledError);
  });

  it('uses the real path when the flag is true', async () => {
    flags.real = true;
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    expect(prepared.mode).toBe('real');
    const persist = vi.fn(async () => ({ signature: 'sig-real' }));
    const sent = await submitAndVerifyBurn({
      prepared,
      connection: mockConnection(),
      wallet: {
        sendTransaction: async (transaction: Transaction) => {
          expect(transaction.recentBlockhash).toBe('blockhash-1');
          expect(transaction.feePayer?.toBase58()).toBe(wallet);
          return 'sig-real';
        },
      },
      persist,
    });
    expect(sent.signature).toBe('sig-real');
    expect(sent.record.amountRaw).toBe('250000000000');
    expect(persist).toHaveBeenCalledWith('sig-real');
    expect(shouldRefreshAfterVerifiedBurn({ mode: 'real', verified: true })).toBe(true);
  });

  it('does not persist or refresh ranking before verification succeeds', async () => {
    flags.real = true;
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    const persist = vi.fn(async () => undefined);
    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection({
          getParsedTransaction: async () => parsedBurnTx('1') as never,
        }),
        wallet: {
          sendTransaction: async () => 'sig-bad-amount',
        },
        persist,
      }),
    ).rejects.toBeInstanceOf(BurnVerificationError);
    expect(persist).not.toHaveBeenCalled();
    expect(shouldRefreshAfterVerifiedBurn({ mode: 'real' })).toBe(false);
  });

  it('maps wallet rejection, confirmation, verification and persistence failures', async () => {
    flags.real = true;
    expect(formatBurnUserError({ name: 'WalletSendTransactionError', message: 'User rejected the request' })).toBe(
      'The offering was withdrawn.',
    );
    expect(formatBurnUserError(new Error('Transaction confirmation timeout'))).toBe(
      'The forest could not confirm the burn.',
    );

    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 250_000_000_000n,
    });
    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: {
          sendTransaction: async () => {
            throw Object.assign(new Error('User rejected the request'), { name: 'WalletSendTransactionError' });
          },
        },
      }),
    ).rejects.toMatchObject({ category: 'wallet-rejected' });

    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: {
          sendTransaction: async () => {
            throw new Error('failed to send transaction');
          },
        },
      }),
    ).rejects.toMatchObject({ category: 'transaction-failed' });

    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection({
          confirmTransaction: async () => ({ value: { err: { InstructionError: [0, 'Custom'] } } }) as never,
        }),
        wallet: { sendTransaction: async () => 'sig' },
      }),
    ).rejects.toMatchObject({ category: 'transaction-failed' });

    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: { sendTransaction: async () => 'sig-real' },
        persist: async () => {
          throw new Error('store failed');
        },
      }),
    ).rejects.toMatchObject({ category: 'persistence-failed' });
  });

  it('requires a wallet that can send or sign transactions', () => {
    expect(walletCanSendTransactions({})).toBe(false);
    expect(walletCanSendTransactions({ sendTransaction: async () => 'sig' })).toBe(true);
    expect(walletCanSendTransactions({ signTransaction: async (tx) => tx })).toBe(true);
  });

  it('reaches wallet send and does not verify without a signature', async () => {
    flags.real = true;
    const persist = vi.fn(async () => undefined);
    const send = vi.fn(async () => '');
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 1_000_000n,
    });
    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: { sendTransaction: send },
        persist,
      }),
    ).rejects.toMatchObject({ stage: 'send' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it('sends through a bound adapter method that uses this.emit', async () => {
    flags.real = true;
    const persist = vi.fn(async () => undefined);
    const adapter = {
      name: 'Backpack',
      connected: true,
      readyState: 'Installed',
      publicKey: { toBase58: () => wallet },
      emit: vi.fn(),
      async sendTransaction() {
        this.emit('sent');
        return 'sig-adapter';
      },
    };
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 1_000_000n,
    });
    const sent = await submitAndVerifyBurn({
      prepared,
      connection: mockConnection({
        getParsedTransaction: async () => parsedBurnTx('1000000') as never,
      }),
      wallet: { adapter },
      persist,
    });
    expect(sent.signature).toBe('sig-adapter');
    expect(adapter.emit).toHaveBeenCalledWith('sent');
    expect(persist).toHaveBeenCalledWith('sig-adapter');
  });

  it('does not persist when the wallet rejects the transaction', async () => {
    flags.real = true;
    const persist = vi.fn(async () => undefined);
    const prepared = prepareBurn({
      wallet,
      mint,
      accounts: balance.accounts,
      amountRaw: 1_000_000n,
    });
    await expect(
      submitAndVerifyBurn({
        prepared,
        connection: mockConnection(),
        wallet: {
          sendTransaction: async () => {
            throw Object.assign(new Error('User rejected the request'), { name: 'WalletSendTransactionError' });
          },
        },
        persist,
      }),
    ).rejects.toMatchObject({ category: 'wallet-rejected' });
    expect(persist).not.toHaveBeenCalled();
  });
});
