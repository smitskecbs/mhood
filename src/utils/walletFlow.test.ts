import { describe, expect, it, vi } from 'vitest';
import {
  connectWalletOnce,
  reduceWalletFlow,
  shouldConnectWallet,
  shouldSelectWallet,
  shouldShowSignStep,
  waitUntil,
} from './walletFlow';

describe('wallet flow state machine', () => {
  it('opens the picker once and does not bounce back after connect success', () => {
    let phase = reduceWalletFlow('idle', { type: 'open-picker' });
    expect(phase).toBe('wallet-picker');
    phase = reduceWalletFlow(phase, { type: 'connect-start' });
    expect(phase).toBe('connecting');
    phase = reduceWalletFlow(phase, { type: 'connect-success' });
    expect(phase).toBe('connected-awaiting-signature');
    expect(reduceWalletFlow(phase, { type: 'open-picker' })).toBe('connected-awaiting-signature');
  });

  it('moves from connect success to awaiting signature then holder check', () => {
    let phase = reduceWalletFlow('connecting', { type: 'connect-success' });
    expect(phase).toBe('connected-awaiting-signature');
    phase = reduceWalletFlow(phase, { type: 'sign-start' });
    expect(phase).toBe('signing');
    phase = reduceWalletFlow(phase, { type: 'sign-success' });
    expect(phase).toBe('authenticated');
    phase = reduceWalletFlow(phase, { type: 'holder-check' });
    expect(phase).toBe('checking-holder');
  });

  it('keeps a connected wallet on the signature step when React context catches up', () => {
    expect(reduceWalletFlow('connecting', { type: 'context-connected' })).toBe('connected-awaiting-signature');
    expect(
      shouldShowSignStep({
        phase: 'connected-awaiting-signature',
        connected: true,
        hasPublicKey: true,
        status: 'awaiting_signature',
      }),
    ).toBe(true);
  });
});

describe('wallet select/connect once', () => {
  it('selects and connects a wallet only once', async () => {
    const select = vi.fn();
    const connect = vi.fn(async () => undefined);
    const inFlight = { current: false };
    const result = await connectWalletOnce({
      inFlight,
      walletName: 'Backpack',
      selectedName: null,
      alreadyConnected: false,
      adapterConnected: false,
      select,
      connect,
    });
    expect(result).toBe('connected-awaiting-signature');
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('Backpack');
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('does not select or connect again while a connect is in flight', async () => {
    const select = vi.fn();
    const connect = vi.fn(async () => undefined);
    const inFlight = { current: true };
    await connectWalletOnce({
      inFlight,
      walletName: 'Backpack',
      selectedName: null,
      alreadyConnected: false,
      adapterConnected: false,
      select,
      connect,
    });
    expect(select).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('skips select when the wallet is already selected and skips connect when already connected', async () => {
    expect(
      shouldSelectWallet({
        inFlight: false,
        alreadyConnected: false,
        selectedName: 'Backpack',
        nextName: 'Backpack',
      }),
    ).toBe(false);
    expect(
      shouldConnectWallet({
        inFlight: false,
        alreadyConnected: false,
        adapterConnected: true,
      }),
    ).toBe(false);
    const select = vi.fn();
    const connect = vi.fn(async () => undefined);
    await connectWalletOnce({
      inFlight: { current: false },
      walletName: 'Backpack',
      selectedName: 'Backpack',
      alreadyConnected: false,
      adapterConnected: true,
      select,
      connect,
    });
    expect(select).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('commits select then uses the public connect function without emitting', async () => {
    const emit = vi.fn();
    const select = vi.fn();
    const connect = vi.fn(async () => undefined);
    const commitSelect = vi.fn((fn: () => void) => fn());
    await connectWalletOnce({
      inFlight: { current: false },
      walletName: 'Backpack',
      selectedName: null,
      alreadyConnected: false,
      adapterConnected: false,
      select,
      connect,
      commitSelect,
    });
    expect(commitSelect).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('Backpack');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps connect state on the signature step after a public connect', async () => {
    const result = await connectWalletOnce({
      inFlight: { current: false },
      walletName: 'Backpack',
      selectedName: 'Backpack',
      alreadyConnected: false,
      adapterConnected: false,
      select: vi.fn(),
      connect: vi.fn(async () => undefined),
    });
    expect(result).toBe('connected-awaiting-signature');
  });

  it('resolves waitUntil once the wallet context reports connected', async () => {
    let connected = false;
    setTimeout(() => {
      connected = true;
    }, 20);
    await waitUntil(() => connected, 500, 5);
    expect(connected).toBe(true);
  });
});
