import type { Connection, Transaction, TransactionSignature } from '@solana/web3.js';
import { burnLog } from './burnLog';

export type WalletSendAdapter = {
  name?: string;
  connected?: boolean;
  readyState?: unknown;
  publicKey?: { toBase58(): string } | null;
  sendTransaction?: (
    transaction: Transaction,
    connection: Connection,
    options?: object,
  ) => Promise<TransactionSignature>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
} | null;

export type WalletSendSource = {
  connected?: boolean;
  publicKey?: { toBase58(): string } | null;
  sendTransaction?: (
    transaction: Transaction,
    connection: Connection,
    options?: object,
  ) => Promise<TransactionSignature>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  adapter?: WalletSendAdapter;
};

export function isSameWalletAdapter(left: unknown, right: unknown): boolean {
  return left != null && left === right;
}

export function getAdapterClassName(adapter: object | null | undefined): string {
  if (!adapter) return 'none';
  const name = adapter.constructor?.name;
  return name && name !== 'Object' ? name : 'unknown';
}

export function adapterHasSendTransaction(adapter: WalletSendAdapter): boolean {
  return typeof adapter?.sendTransaction === 'function';
}

export function contextHasSendTransaction(wallet: WalletSendSource): boolean {
  return typeof wallet.sendTransaction === 'function';
}

/**
 * Call adapter methods on the adapter object. Extracting `adapter.sendTransaction`
 * and invoking it unbound makes `this` undefined; wallet-adapter then crashes on
 * `this.emit('error', ...)`.
 */
export function bindAdapterSendTransaction(
  adapter: WalletSendAdapter,
):
  | ((transaction: Transaction, connection: Connection, options?: object) => Promise<TransactionSignature>)
  | undefined {
  if (!adapter || typeof adapter.sendTransaction !== 'function') return undefined;
  return (transaction, connection, options) => adapter.sendTransaction!(transaction, connection, options);
}

export function describeWalletSendStage(params: {
  wallet: WalletSendSource;
  transaction: Transaction;
}): {
  connected: boolean;
  publicKey: string;
  adapterName: string;
  adapterClass: string;
  adapterReadyState: string;
  adapterHasSendTransaction: boolean;
  contextHasSendTransaction: boolean;
  sameAdapterInstance: boolean;
  feePayer: string;
  recentBlockhashSet: boolean;
} {
  const { wallet, transaction } = params;
  const adapter = wallet.adapter ?? null;
  const publicKey = wallet.publicKey?.toBase58() ?? adapter?.publicKey?.toBase58() ?? 'none';
  return {
    connected: Boolean(wallet.connected ?? adapter?.connected),
    publicKey,
    adapterName: adapter?.name ?? 'none',
    adapterClass: getAdapterClassName(adapter ?? undefined),
    adapterReadyState: adapter?.readyState != null ? String(adapter.readyState) : 'unknown',
    adapterHasSendTransaction: adapterHasSendTransaction(adapter),
    contextHasSendTransaction: contextHasSendTransaction(wallet),
    sameAdapterInstance: isSameWalletAdapter(adapter, wallet.adapter),
    feePayer: transaction.feePayer?.toBase58() ?? 'none',
    recentBlockhashSet: Boolean(transaction.recentBlockhash),
  };
}

export function logWalletSendStage(params: { wallet: WalletSendSource; transaction: Transaction }): void {
  const stage = describeWalletSendStage(params);
  burnLog('send stage');
  burnLog(`wallet connected: ${stage.connected}`);
  burnLog(`public key: ${stage.publicKey}`);
  burnLog(`adapter name: ${stage.adapterName}`);
  burnLog(`connected wallet name: ${stage.adapterName}`);
  burnLog(`connected adapter class: ${stage.adapterClass}`);
  burnLog(`send adapter name: ${stage.adapterName}`);
  burnLog(`same adapter instance: ${stage.sameAdapterInstance}`);
  burnLog(`adapter ready state: ${stage.adapterReadyState}`);
  burnLog(`adapter has sendTransaction: ${stage.adapterHasSendTransaction}`);
  burnLog(`wallet context has sendTransaction: ${stage.contextHasSendTransaction}`);
  burnLog(`transaction feePayer: ${stage.feePayer}`);
  burnLog(`transaction recentBlockhash set: ${stage.recentBlockhashSet}`);
}

export async function sendWalletTransaction(params: {
  transaction: Transaction;
  connection: Connection;
  wallet: WalletSendSource;
  options?: object;
}): Promise<TransactionSignature> {
  const { transaction, connection, wallet } = params;
  const options = params.options ?? { skipPreflight: false, preflightCommitment: 'confirmed' as const };
  logWalletSendStage({ wallet, transaction });

  if (typeof wallet.sendTransaction === 'function') {
    burnLog('calling wallet sendTransaction');
    return wallet.sendTransaction(transaction, connection, options);
  }

  const adapter = wallet.adapter;
  if (adapter && typeof adapter.sendTransaction === 'function') {
    burnLog('calling wallet sendTransaction');
    return adapter.sendTransaction(transaction, connection, options);
  }

  if (adapter && typeof adapter.signTransaction === 'function') {
    burnLog('calling wallet sendTransaction');
    const signed = await adapter.signTransaction(transaction);
    return connection.sendRawTransaction(signed.serialize(), options);
  }

  if (typeof wallet.signTransaction === 'function') {
    burnLog('calling wallet sendTransaction');
    const signed = await wallet.signTransaction(transaction);
    return connection.sendRawTransaction(signed.serialize(), options);
  }

  throw new Error('Connected wallet cannot sign or send transactions.');
}
