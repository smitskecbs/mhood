import { PublicKey, Transaction, type Connection } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import {
  adapterHasSendTransaction,
  bindAdapterSendTransaction,
  contextHasSendTransaction,
  describeWalletSendStage,
  getAdapterClassName,
  isSameWalletAdapter,
  sendWalletTransaction,
} from './walletSend';

class MimicBackpackAdapter {
  name = 'Backpack';
  connected = true;
  readyState = 'Installed';
  publicKey = { toBase58: () => '11111111111111111111111111111111' };
  _wallet = { send: async () => 'sig-bound' };

  emit(event: string) {
    void event;
  }

  async sendTransaction() {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new Error('not connected');
      return await wallet.send();
    } catch (error) {
      this.emit('error');
      throw error;
    }
  }
}

const connection = {
  sendRawTransaction: async () => 'sig-raw',
} as unknown as Connection;

function signedTx(): Transaction {
  const transaction = new Transaction();
  transaction.feePayer = new PublicKey(1);
  transaction.recentBlockhash = 'blockhash-1';
  return transaction;
}

describe('wallet send binding', () => {
  it('keeps the same adapter instance for connect and send', () => {
    const adapter = new MimicBackpackAdapter();
    expect(isSameWalletAdapter(adapter, adapter)).toBe(true);
    expect(isSameWalletAdapter(adapter, new MimicBackpackAdapter())).toBe(false);
    expect(getAdapterClassName(adapter)).toBe('MimicBackpackAdapter');
  });

  it('does not pull sendTransaction off the adapter', async () => {
    const adapter = new MimicBackpackAdapter();
    const unbound = adapter.sendTransaction;
    await expect(unbound()).rejects.toThrow(/emit/);

    const bound = bindAdapterSendTransaction(adapter);
    await expect(bound?.(signedTx(), connection)).resolves.toBe('sig-bound');
  });

  it('prefers the wallet-context sendTransaction over an adapter method', async () => {
    const adapter = new MimicBackpackAdapter();
    const contextSend = vi.fn(async () => 'sig-context');
    const signature = await sendWalletTransaction({
      transaction: signedTx(),
      connection,
      wallet: {
        connected: true,
        publicKey: adapter.publicKey,
        sendTransaction: contextSend,
        adapter,
      },
    });
    expect(signature).toBe('sig-context');
    expect(contextSend).toHaveBeenCalledTimes(1);
  });

  it('calls adapter.sendTransaction as a method so this.emit stays valid', async () => {
    const adapter = new MimicBackpackAdapter();
    const signature = await sendWalletTransaction({
      transaction: signedTx(),
      connection,
      wallet: { adapter },
    });
    expect(signature).toBe('sig-bound');
    expect(adapterHasSendTransaction(adapter)).toBe(true);
    expect(contextHasSendTransaction({ adapter })).toBe(false);
  });

  it('describes a ready Backpack send stage', () => {
    const adapter = new MimicBackpackAdapter();
    const transaction = signedTx();
    const stage = describeWalletSendStage({
      transaction,
      wallet: {
        connected: true,
        publicKey: adapter.publicKey,
        sendTransaction: async () => 'sig',
        adapter,
      },
    });
    expect(stage).toMatchObject({
      connected: true,
      publicKey: '11111111111111111111111111111111',
      adapterName: 'Backpack',
      adapterClass: 'MimicBackpackAdapter',
      adapterReadyState: 'Installed',
      adapterHasSendTransaction: true,
      contextHasSendTransaction: true,
      sameAdapterInstance: true,
      recentBlockhashSet: true,
    });
  });
});
