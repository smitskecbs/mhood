import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, toUint8Array } from '../utils/walletAuth';
import { resetHolderVerification } from '../utils/walletInteraction';
import type { MintDetails, WalletMhoodBalance } from '../types';

const mocks = vi.hoisted(() => ({
  fetchBalance: vi.fn(),
  fetchMint: vi.fn(),
  wallet: {
    connected: false,
    connecting: false,
    disconnecting: false,
    publicKey: null as ReturnType<typeof Keypair.generate>['publicKey'] | null,
    signMessage: undefined as ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
    wallet: {
      adapter: {
        name: 'Backpack',
        signMessage: undefined as ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
      },
    },
  },
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mocks.wallet,
}));

vi.mock('../services/solana/mintService', () => ({
  fetchMintDetails: (...args: unknown[]) => mocks.fetchMint(...args),
}));

vi.mock('../services/mhoodBalanceService', async () => {
  const actual = await vi.importActual<typeof import('../services/mhoodBalanceService')>(
    '../services/mhoodBalanceService',
  );
  return {
    ...actual,
    fetchWalletMhoodBalance: (...args: unknown[]) => mocks.fetchBalance(...args),
  };
});

vi.mock('../services/solana/connection', () => ({
  getConnection: () => ({}),
}));

vi.mock('../config/env', async () => {
  const actual = await vi.importActual<typeof import('../config/env')>('../config/env');
  return {
    ...actual,
    requireConfiguredRpcUrl: () => 'https://rpc.test',
  };
});

import { useForestAccess } from './useForestAccess';

const mint: MintDetails = {
  mint: 'EiuaNV7T3Uz7yoVxkgxZQGXENreyBUqDWnfBLjbsYVVs',
  decimals: 6,
  supplyRaw: 1n,
  tokenProgramId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  tokenProgramKind: 'spl-token',
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  space: 82,
};

function balanceFor(wallet: string, totalRaw: bigint): WalletMhoodBalance {
  return {
    wallet,
    mint: mint.mint,
    decimals: 6,
    tokenProgramKind: 'spl-token',
    totalRaw,
    accounts: [],
    meetsAccessThreshold: totalRaw >= 1_000_000_000_000n,
    fetchedAt: 0,
  };
}

function connectWallet(options?: { sign?: boolean }) {
  const keypair = Keypair.generate();
  mocks.wallet.connected = true;
  mocks.wallet.publicKey = keypair.publicKey;
  if (options?.sign === false) {
    mocks.wallet.signMessage = undefined;
    mocks.wallet.wallet.adapter.signMessage = undefined;
    return keypair;
  }
  const sign = async (message: Uint8Array) =>
    nacl.sign.detached(toUint8Array(message), toUint8Array(keypair.secretKey));
  mocks.wallet.signMessage = sign;
  mocks.wallet.wallet.adapter.signMessage = sign;
  return keypair;
}

describe('useForestAccess signature gate', () => {
  beforeEach(() => {
    mocks.fetchBalance.mockReset();
    mocks.fetchMint.mockReset();
    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    mocks.wallet.signMessage = undefined;
    mocks.wallet.wallet.adapter.signMessage = undefined;
    mocks.fetchMint.mockResolvedValue(mint);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    resetHolderVerification();
  });

  it('does not start the holder check on connect alone', async () => {
    connectWallet();
    const { result } = renderHook(() => useForestAccess());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('awaiting_signature');
    expect(result.current.authenticated).toBe(false);
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
    shouldNotPersistAuth();
  });

  it('authenticates a valid signature and then checks the holder balance', async () => {
    const keypair = connectWallet();
    mocks.fetchBalance.mockResolvedValue(balanceFor(keypair.publicKey.toBase58(), 1_000_000_000_000n));
    const { result } = renderHook(() => useForestAccess());

    await act(async () => {
      await result.current.authenticate();
    });

    await waitFor(() => {
      expect(result.current.authenticated).toBe(true);
      expect(result.current.status).toBe('granted');
    });
    expect(mocks.fetchBalance).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('denies an invalid signature without starting the holder check', async () => {
    const keypair = connectWallet();
    mocks.wallet.signMessage = async () => new Uint8Array(64);
    mocks.wallet.wallet.adapter.signMessage = mocks.wallet.signMessage;
    const { result } = renderHook(() => useForestAccess());

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.authIssue).toBe('invalid');
    expect(result.current.status).toBe('awaiting_signature');
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
    expect(keypair.publicKey.toBase58()).toBeTruthy();
  });

  it('keeps the wallet connected when the signature is rejected', async () => {
    connectWallet();
    mocks.wallet.signMessage = async () => {
      throw Object.assign(new Error('User rejected the request'), { name: 'WalletSignMessageError' });
    };
    const { result } = renderHook(() => useForestAccess());

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.authenticated).toBe(false);
    expect(result.current.authIssue).toBe('rejected');
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
  });

  it('denies a wallet without signMessage', async () => {
    connectWallet({ sign: false });
    const { result } = renderHook(() => useForestAccess());
    expect(result.current.authIssue).toBe('unsupported');
    await act(async () => {
      await result.current.authenticate();
    });
    expect(result.current.authenticated).toBe(false);
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
  });

  it('resets authentication on account switch', async () => {
    const first = connectWallet();
    mocks.fetchBalance.mockResolvedValue(balanceFor(first.publicKey.toBase58(), 4_820_000_000_000n));
    const { result, rerender } = renderHook(() => useForestAccess());
    await act(async () => {
      await result.current.authenticate();
    });
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    const second = Keypair.generate();
    mocks.wallet.publicKey = second.publicKey;
    mocks.wallet.signMessage = async (message) => nacl.sign.detached(toUint8Array(message), toUint8Array(second.secretKey));
    rerender();

    await waitFor(() => {
      expect(result.current.authenticated).toBe(false);
      expect(result.current.status).toBe('awaiting_signature');
    });
  });

  it('resets authentication on disconnect', async () => {
    const keypair = connectWallet();
    mocks.fetchBalance.mockResolvedValue(balanceFor(keypair.publicKey.toBase58(), 4_820_000_000_000n));
    const { result, rerender } = renderHook(() => useForestAccess());
    await act(async () => {
      await result.current.authenticate();
    });
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    rerender();

    await waitFor(() => {
      expect(result.current.authenticated).toBe(false);
      expect(result.current.status).toBe('disconnected');
    });
  });

  it('grants only after signature when the wallet holds at least 1,000,000 MHOOD', async () => {
    const keypair = connectWallet();
    mocks.fetchBalance.mockResolvedValue(balanceFor(keypair.publicKey.toBase58(), 1_000_000_000_000n));
    const { result } = renderHook(() => useForestAccess());
    expect(result.current.status).not.toBe('granted');
    await act(async () => {
      await result.current.authenticate();
    });
    await waitFor(() => expect(result.current.status).toBe('granted'));
  });

  it('keeps a verified wallet out of the Forest below 1,000,000 MHOOD', async () => {
    const keypair = connectWallet();
    mocks.fetchBalance.mockResolvedValue(balanceFor(keypair.publicKey.toBase58(), 742_381_000_000n));
    const { result } = renderHook(() => useForestAccess());
    await act(async () => {
      await result.current.authenticate();
    });
    await waitFor(() => expect(result.current.status).toBe('insufficient'));
  });
});

function shouldNotPersistAuth() {
  expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
}
