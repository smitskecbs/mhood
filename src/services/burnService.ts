import { createBurnCheckedInstruction } from '@solana/spl-token';
import {
  PublicKey,
  Transaction,
  type Connection,
  type TransactionInstruction,
} from '@solana/web3.js';
import type {
  BurnErrorCategory,
  BurnRecord,
  MintDetails,
  PreparedBurn,
  TokenAccountBalance,
  WalletMhoodBalance,
} from '../types';
import { appConfig, isRealBurnEnabled } from '../config/env';
import { COPY } from '../config/constants';
import { allocateBurnAcrossAccounts } from '../utils/accounts';
import { burnErrorLog, burnLog } from '../utils/burnLog';
import { formatTokenAmount } from '../utils/tokenAmount';
import { isSignatureUserRejection } from '../utils/walletAuth';
import { sendWalletTransaction, type WalletSendSource } from '../utils/walletSend';
import { getConnection } from './solana/connection';
import { getTokenProgramPublicKey } from './solana/mintService';
import { BurnVerificationError, confirmAndVerifyBurn } from './burnVerification';

export class RealBurnDisabledError extends Error {
  readonly prepared: PreparedBurn;

  constructor(prepared: PreparedBurn) {
    super('Real MHOOD burns are disabled. Set VITE_ENABLE_REAL_BURN=true to enable them.');
    this.name = 'RealBurnDisabledError';
    this.prepared = prepared;
  }
}

export class BurnFlowError extends Error {
  readonly stage: string;
  readonly category: BurnErrorCategory;

  constructor(stage: string, category: BurnErrorCategory, message: string) {
    super(message);
    this.name = 'BurnFlowError';
    this.stage = stage;
    this.category = category;
  }
}

export type PreparedBurnTransaction = {
  transaction: Transaction;
  blockhash: string;
  lastValidBlockHeight: number;
};

export type WalletTransactionSender = WalletSendSource;

export function walletCanSendTransactions(wallet: WalletTransactionSender): boolean {
  return (
    typeof wallet.sendTransaction === 'function' ||
    typeof wallet.signTransaction === 'function' ||
    typeof wallet.adapter?.sendTransaction === 'function' ||
    typeof wallet.adapter?.signTransaction === 'function'
  );
}

export function shouldRefreshAfterVerifiedBurn(result: { mode: string; verified?: boolean }): boolean {
  return result.mode === 'real' && result.verified === true;
}

export function assertBurnSafety(mint: MintDetails, amountRaw: bigint, balance: WalletMhoodBalance): void {
  if (amountRaw <= 0n) {
    throw new BurnFlowError('validation', 'unknown', 'Burn amount must be greater than zero');
  }
  if (balance.totalRaw < amountRaw) {
    throw new BurnFlowError('validation', 'unknown', 'Burn amount exceeds wallet MHOOD balance');
  }
  if (mint.mint !== appConfig.mintAddress) {
    throw new BurnFlowError('validation', 'unknown', 'Mint mismatch — refusing to build a burn');
  }
  if (mint.decimals < 0 || mint.decimals > 18) {
    throw new BurnFlowError('validation', 'unknown', 'Mint decimals look invalid');
  }
}

export function prepareBurn(params: {
  wallet: string;
  mint: MintDetails;
  accounts: TokenAccountBalance[];
  amountRaw: bigint;
}): PreparedBurn {
  const { wallet, mint, accounts, amountRaw } = params;
  const allocations = allocateBurnAcrossAccounts(accounts, amountRaw);

  return {
    mode: isRealBurnEnabled() ? 'real' : 'simulation',
    wallet,
    mint: mint.mint,
    tokenProgramId: mint.tokenProgramId,
    tokenProgramKind: mint.tokenProgramKind,
    decimals: mint.decimals,
    amountRaw,
    amountUi: formatTokenAmount(amountRaw, mint.decimals),
    allocations,
    instructionCount: allocations.length,
  };
}

export function buildBurnInstructions(prepared: PreparedBurn): TransactionInstruction[] {
  const mint = new PublicKey(prepared.mint);
  const owner = new PublicKey(prepared.wallet);
  const programId = getTokenProgramPublicKey(prepared.tokenProgramKind);

  return prepared.allocations.map((allocation) =>
    createBurnCheckedInstruction(
      new PublicKey(allocation.tokenAccount),
      mint,
      owner,
      allocation.amountRaw,
      prepared.decimals,
      [],
      programId,
    ),
  );
}

export async function buildBurnTransaction(
  prepared: PreparedBurn,
  connection: Connection = getConnection(),
): Promise<PreparedBurnTransaction> {
  const owner = new PublicKey(prepared.wallet);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction();
  transaction.feePayer = owner;
  transaction.recentBlockhash = blockhash;
  transaction.add(...buildBurnInstructions(prepared));
  return { transaction, blockhash, lastValidBlockHeight };
}

async function sendBurnTransaction(
  params: {
    transaction: Transaction;
    connection: Connection;
    wallet: WalletTransactionSender;
  },
): Promise<string> {
  const signature = await sendWalletTransaction(params);
  if (typeof signature !== 'string' || !signature) {
    throw new BurnFlowError('send', 'transaction-failed', COPY.burnCouldNotComplete);
  }
  return signature;
}

export async function confirmBurnSignature(
  connection: Connection,
  signature: string,
  latest: { blockhash: string; lastValidBlockHeight: number },
): Promise<void> {
  try {
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed',
    );
    if (confirmation.value.err) {
      throw new BurnFlowError('confirm', 'transaction-failed', 'The burn transaction failed on-chain.');
    }
    return;
  } catch (err) {
    if (err instanceof BurnFlowError) throw err;
    await pollSignatureConfirmed(connection, signature);
  }
}

export async function pollSignatureConfirmed(
  connection: Connection,
  signature: string,
  timeoutMs = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature]);
    const value = statuses.value[0];
    if (value?.err) {
      throw new BurnFlowError('confirm', 'transaction-failed', 'The burn transaction failed on-chain.');
    }
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  throw new BurnFlowError('confirm', 'rpc-unavailable', COPY.burnUnconfirmed);
}

export async function executePreparedBurn(params: {
  prepared: PreparedBurn;
  sendTransaction: (transaction: Transaction) => Promise<string>;
}): Promise<{ signature: string; prepared: PreparedBurn }> {
  if (!isRealBurnEnabled()) {
    throw new RealBurnDisabledError(params.prepared);
  }
  if (params.prepared.mode !== 'real') {
    throw new Error('Prepared burn is not in real mode');
  }

  const built = await buildBurnTransaction(params.prepared);
  const signature = await params.sendTransaction(built.transaction);
  return { signature, prepared: params.prepared };
}

export function simulationResultMessage(prepared: PreparedBurn): string {
  return `Simulation only. ${prepared.amountUi} MHOOD was NOT burned. No transaction was sent.`;
}

export function categorizeBurnError(err: unknown): BurnErrorCategory {
  if (err instanceof BurnFlowError) return err.category;
  if (isSignatureUserRejection(err)) return 'wallet-rejected';
  if (err instanceof BurnVerificationError) return 'verification-failed';
  const message = err instanceof Error ? err.message : String(err);
  if (/persist|verified-burns|store/i.test(message)) return 'persistence-failed';
  if (/confirm|timeout|blockhash|not found/i.test(message)) return 'rpc-unavailable';
  if (/failed on-chain|Transaction simulation failed|0x/i.test(message)) return 'transaction-failed';
  if (/RPC|fetch|network|429|403/i.test(message)) return 'rpc-unavailable';
  return 'unknown';
}

export function formatBurnUserError(err: unknown): string {
  if (isSignatureUserRejection(err) || categorizeBurnError(err) === 'wallet-rejected') {
    return COPY.offeringWithdrawn;
  }
  if (err instanceof BurnVerificationError) {
    return err.message;
  }
  if (err instanceof BurnFlowError) {
    if (err.category === 'wallet-rejected') return COPY.offeringWithdrawn;
    return err.message || COPY.burnCouldNotComplete;
  }
  const message = err instanceof Error ? err.message : '';
  if (/confirm|timeout|blockhash|not found/i.test(message)) {
    return COPY.burnUnconfirmed;
  }
  return COPY.burnCouldNotComplete;
}

export function formatBurnDevCategory(err: unknown): BurnErrorCategory {
  return categorizeBurnError(err);
}

/**
 * Builds official BurnChecked instructions, asks the wallet to sign/send,
 * waits for confirmation, then verifies the on-chain BurnChecked amount.
 * Sending is blocked unless VITE_ENABLE_REAL_BURN=true.
 */
export async function submitAndVerifyBurn(params: {
  prepared: PreparedBurn;
  connection?: Connection;
  wallet: WalletTransactionSender;
  persist?: (signature: string) => Promise<unknown>;
}): Promise<{ signature: string; prepared: PreparedBurn; record: BurnRecord }> {
  if (!isRealBurnEnabled()) {
    throw new RealBurnDisabledError(params.prepared);
  }
  if (params.prepared.mode !== 'real') {
    throw new Error('Prepared burn is not in real mode');
  }
  if (!walletCanSendTransactions(params.wallet)) {
    throw new BurnFlowError('wallet-approval', 'unknown', 'Connected wallet cannot sign or send transactions.');
  }

  const connection = params.connection ?? getConnection();
  burnLog('transaction built');
  let built: PreparedBurnTransaction;
  try {
    built = await buildBurnTransaction(params.prepared, connection);
  } catch (err) {
    burnErrorLog('build', err);
    throw new BurnFlowError('build', 'rpc-unavailable', COPY.burnUnconfirmed);
  }

  burnLog('requesting wallet approval');
  let signature: string;
  try {
    signature = await sendBurnTransaction({
      transaction: built.transaction,
      connection,
      wallet: params.wallet,
    });
  } catch (err) {
    const stage = isSignatureUserRejection(err) ? 'wallet-approval' : 'send';
    burnErrorLog(stage, err);
    if (isSignatureUserRejection(err)) {
      throw new BurnFlowError('wallet-approval', 'wallet-rejected', COPY.offeringWithdrawn);
    }
    throw new BurnFlowError('send', 'transaction-failed', COPY.burnCouldNotComplete);
  }

  burnLog(`transaction signature: ${signature}`);
  burnLog('confirming transaction');
  try {
    await confirmBurnSignature(connection, signature, {
      blockhash: built.transaction.recentBlockhash ?? built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    });
  } catch (err) {
    burnErrorLog('confirm', err);
    if (err instanceof BurnFlowError) throw err;
    throw new BurnFlowError('confirm', 'rpc-unavailable', COPY.burnUnconfirmed);
  }
  burnLog('transaction confirmed');

  burnLog('verifying BurnChecked on-chain');
  let record: BurnRecord;
  try {
    record = await confirmAndVerifyBurn(
      connection,
      signature,
      {
        mint: params.prepared.mint,
        wallet: params.prepared.wallet,
        amountRaw: params.prepared.amountRaw,
      },
      params.prepared.decimals,
    );
  } catch (err) {
    burnErrorLog('verify', err);
    throw err instanceof BurnVerificationError
      ? err
      : new BurnFlowError('verify', 'verification-failed', COPY.burnUnconfirmed);
  }
  burnLog('burn verification: true');

  if (params.persist) {
    burnLog('saving verified burn');
    try {
      await params.persist(signature);
    } catch (err) {
      burnErrorLog('persist', err);
      throw new BurnFlowError('persist', 'persistence-failed', COPY.burnCouldNotComplete);
    }
    burnLog('verified burn saved');
  }

  return { signature, prepared: params.prepared, record };
}
