import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { describe, expect, it, vi } from 'vitest';
import { parseRealBurnFlag } from '../config/env';
import { createHolderRankingService } from '../services/holderRankingService';
import {
  AUTH_STORAGE_KEY,
  buildForestAccessMessage,
  createAuthNonce,
  encodeUtf8,
  isSignatureUserRejection,
  readPersistedWalletAuthentication,
  shouldStartHolderCheck,
  toUint8Array,
  verifyEd25519Signature,
  walletCanSignMessage,
} from './walletAuth';

describe('forest access message', () => {
  it('asks only for a proof-of-ownership signature', () => {
    const message = buildForestAccessMessage({
      wallet: 'DemoWallet111111111111111111111111111111111',
      nonce: 'abc123',
      issuedAt: '2026-08-22T12:00:00.000Z',
      origin: 'http://localhost:5173',
    });

    expect(message).toBe(
      [
        'MoginHood Forest Access',
        '',
        'Sign this message to prove ownership of this wallet.',
        '',
        'App: moginhood-forest',
        'Origin: http://localhost:5173',
        'Wallet: DemoWallet111111111111111111111111111111111',
        'Nonce: abc123',
        'Issued At: 2026-08-22T12:00:00.000Z',
        '',
        'This signature does not authorize a transaction or token transfer.',
      ].join('\n'),
    );
    expect(message).not.toMatch(/send SOL|approve a transaction|token burn/i);
  });
});

describe('nonce', () => {
  it('creates a unique cryptographic nonce per attempt', () => {
    const first = createAuthNonce();
    const second = createAuthNonce();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(first).not.toBe(second);
  });

  it('reads bytes from the provided CSPRNG, not Math.random', () => {
    const random = vi.fn((size: number) => new Uint8Array(size).fill(7));
    expect(createAuthNonce(random)).toBe('07'.repeat(16));
    expect(random).toHaveBeenCalledWith(16);
  });
});

describe('Ed25519 verification', () => {
  it('accepts a valid signature over the exact UTF-8 message', () => {
    const keypair = Keypair.generate();
    const message = buildForestAccessMessage({
      wallet: keypair.publicKey.toBase58(),
      nonce: createAuthNonce(),
      issuedAt: new Date().toISOString(),
      origin: 'http://localhost:5173',
    });
    const messageBytes = toUint8Array(encodeUtf8(message));
    const signature = nacl.sign.detached(messageBytes, toUint8Array(keypair.secretKey));
    expect(
      verifyEd25519Signature({
        messageBytes,
        signature,
        publicKeyBytes: keypair.publicKey.toBytes(),
      }),
    ).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const keypair = Keypair.generate();
    const messageBytes = toUint8Array(encodeUtf8('MoginHood Forest Access'));
    const signature = nacl.sign.detached(messageBytes, toUint8Array(keypair.secretKey));
    signature[0] = (signature[0] + 1) % 256;
    expect(
      verifyEd25519Signature({
        messageBytes,
        signature,
        publicKeyBytes: keypair.publicKey.toBytes(),
      }),
    ).toBe(false);
  });
});

describe('signMessage support and rejection', () => {
  it('detects wallets that can sign messages', () => {
    expect(walletCanSignMessage(async () => new Uint8Array(64))).toBe(true);
    expect(walletCanSignMessage(undefined, { signMessage: async () => new Uint8Array(64) })).toBe(true);
    expect(walletCanSignMessage(undefined, {})).toBe(false);
  });

  it('detects a user rejected signature', () => {
    expect(isSignatureUserRejection({ name: 'WalletSignMessageError', message: 'User rejected the request' })).toBe(
      true,
    );
    expect(isSignatureUserRejection(new Error('network failed'))).toBe(false);
  });
});

describe('holder-check gate', () => {
  it('does not start the holder check before a verified signature', () => {
    expect(
      shouldStartHolderCheck({ connected: true, publicKey: 'WalletA', authenticated: false }),
    ).toBe(false);
    expect(
      shouldStartHolderCheck({ connected: true, publicKey: 'WalletA', authenticated: true }),
    ).toBe(true);
  });
});

describe('session-only authentication', () => {
  it('never treats localStorage as an authenticated session', () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ authenticated: true })),
    };
    expect(readPersistedWalletAuthentication(storage)).toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });
});

describe('unchanged safety rails', () => {
  it('keeps real burns disabled unless the env flag is the string true', () => {
    expect(parseRealBurnFlag(undefined)).toBe(false);
    expect(parseRealBurnFlag('true')).toBe(true);
  });

  it('keeps live Helius/RPC holder ranking', () => {
    expect(createHolderRankingService()).toBeTruthy();
  });
});
