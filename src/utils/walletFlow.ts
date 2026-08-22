import type { AccessStatus } from '../types';

export type WalletFlowPhase =
  | 'idle'
  | 'wallet-picker'
  | 'connecting'
  | 'connected-awaiting-signature'
  | 'signing'
  | 'authenticated'
  | 'checking-holder'
  | 'granted'
  | 'error';

export type WalletFlowEvent =
  | { type: 'open-picker' }
  | { type: 'connect-start' }
  | { type: 'connect-success' }
  | { type: 'connect-error' }
  | { type: 'sign-start' }
  | { type: 'sign-success' }
  | { type: 'sign-fail' }
  | { type: 'holder-check' }
  | { type: 'granted' }
  | { type: 'context-connected' }
  | { type: 'disconnect' };

const CONNECTED_PHASES: readonly WalletFlowPhase[] = [
  'connected-awaiting-signature',
  'signing',
  'authenticated',
  'checking-holder',
  'granted',
];

export function isAwaitingSignaturePhase(phase: WalletFlowPhase): boolean {
  return phase === 'connected-awaiting-signature' || phase === 'signing';
}

export function reduceWalletFlow(phase: WalletFlowPhase, event: WalletFlowEvent): WalletFlowPhase {
  switch (event.type) {
    case 'open-picker':
      if (CONNECTED_PHASES.includes(phase) || phase === 'connecting') return phase;
      return 'wallet-picker';
    case 'connect-start':
      if (CONNECTED_PHASES.includes(phase)) return phase;
      return 'connecting';
    case 'connect-success':
    case 'context-connected':
      if (phase === 'signing' || phase === 'authenticated' || phase === 'checking-holder' || phase === 'granted') {
        return phase;
      }
      return 'connected-awaiting-signature';
    case 'connect-error':
      if (CONNECTED_PHASES.includes(phase)) return phase;
      return phase === 'connecting' || phase === 'wallet-picker' ? 'wallet-picker' : 'error';
    case 'sign-start':
      return phase === 'connected-awaiting-signature' || phase === 'signing' ? 'signing' : phase;
    case 'sign-success':
      return 'authenticated';
    case 'sign-fail':
      return 'connected-awaiting-signature';
    case 'holder-check':
      return 'checking-holder';
    case 'granted':
      return 'granted';
    case 'disconnect':
      return 'idle';
    default:
      return phase;
  }
}

export function shouldOpenWalletPicker(phase: WalletFlowPhase, connected: boolean): boolean {
  return !connected && (phase === 'idle' || phase === 'error');
}

export function shouldShowWalletPicker(phase: WalletFlowPhase, connected: boolean): boolean {
  return !connected && (phase === 'wallet-picker' || phase === 'connecting');
}

export function shouldShowSignStep(input: {
  phase: WalletFlowPhase;
  connected: boolean;
  hasPublicKey: boolean;
  status: AccessStatus;
}): boolean {
  if (input.status === 'insufficient' || input.status === 'error' || input.status === 'checking' || input.status === 'granted') {
    return false;
  }
  if (input.connected && input.hasPublicKey && input.status === 'awaiting_signature') return true;
  return isAwaitingSignaturePhase(input.phase);
}

export function shouldSelectWallet(input: {
  inFlight: boolean;
  alreadyConnected: boolean;
  selectedName: string | null;
  nextName: string;
}): boolean {
  if (input.inFlight || input.alreadyConnected) return false;
  return input.selectedName !== input.nextName;
}

export function shouldConnectWallet(input: {
  inFlight: boolean;
  alreadyConnected: boolean;
  adapterConnected: boolean;
}): boolean {
  if (input.inFlight || input.alreadyConnected || input.adapterConnected) return false;
  return true;
}

export function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 16,
): Promise<void> {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for wallet context to connect'));
      }
    }, intervalMs);
  });
}

export async function connectWalletOnce(params: {
  inFlight: { current: boolean };
  walletName: string;
  selectedName: string | null;
  alreadyConnected: boolean;
  adapterConnected: boolean;
  select: (name: string) => void;
  connect: () => Promise<void>;
  commitSelect?: (fn: () => void) => void;
  afterConnect?: () => Promise<void>;
}): Promise<WalletFlowPhase> {
  if (params.alreadyConnected) {
    return 'connected-awaiting-signature';
  }
  if (params.inFlight.current) {
    return 'connecting';
  }

  params.inFlight.current = true;
  try {
    if (
      shouldSelectWallet({
        inFlight: false,
        alreadyConnected: false,
        selectedName: params.selectedName,
        nextName: params.walletName,
      })
    ) {
      const commit = params.commitSelect ?? ((fn) => fn());
      commit(() => params.select(params.walletName));
    }
    if (
      shouldConnectWallet({
        inFlight: false,
        alreadyConnected: false,
        adapterConnected: params.adapterConnected,
      })
    ) {
      await params.connect();
    }
    await params.afterConnect?.();
    return 'connected-awaiting-signature';
  } finally {
    params.inFlight.current = false;
  }
}
