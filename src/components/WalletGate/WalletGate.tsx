import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import { appConfig } from '../../config/env';
import { COPY } from '../../config/constants';
import {
  formatWalletConnectError,
  preferReadyWallets,
  resolveWalletClickAction,
} from '../../config/wallets';
import { formatTokenAmount, uiAmountToRaw } from '../../utils/tokenAmount';
import { useWalletUi } from '../../app/walletUiContext';
import { devLog } from '../../utils/devLog';
import {
  connectWalletOnce,
  reduceWalletFlow,
  shouldShowSignStep,
  shouldShowWalletPicker,
  type WalletFlowPhase,
} from '../../utils/walletFlow';
import { getAdapterClassName } from '../../utils/walletSend';
import { logGateTiming, markInteractionClick, msSinceClick } from '../../utils/gateTiming';
import { signButtonEnabled } from '../../utils/walletInteraction';
import type { AuthIssue } from '../../utils/walletAuth';
import type { AccessStatus, MintDetails, WalletMhoodBalance } from '../../types';

type WalletGateProps = {
  visible: boolean;
  status: AccessStatus;
  mint: MintDetails | null;
  balance: WalletMhoodBalance | null;
  error: string | null;
  errorDetail?: string | null;
  connecting?: boolean;
  signing?: boolean;
  authIssue?: AuthIssue | null;
  onRetry: () => void;
  onSign?: () => void;
};

export function WalletGate({
  visible,
  status,
  mint,
  balance,
  error,
  errorDetail = null,
  connecting = false,
  signing = false,
  authIssue = null,
  onRetry,
  onSign,
}: WalletGateProps) {
  const { connected, disconnect, publicKey, select, connect, wallets, wallet } = useWallet();
  const { connectError, clearConnectError } = useWalletUi();
  const [phase, setPhase] = useState<WalletFlowPhase>('idle');
  const [pickError, setPickError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const connectLogged = useRef(false);
  const connectRef = useRef(connect);
  const walletRef = useRef(wallet);
  const signEnabledLogged = useRef(false);
  connectRef.current = connect;
  walletRef.current = wallet;

  const listed = preferReadyWallets(wallets);
  const connectingThisWallet = phase === 'connecting' || inFlight.current;
  const showProve = shouldShowSignStep({
    phase,
    connected: Boolean(connected && publicKey),
    hasPublicKey: Boolean(publicKey),
    status,
  });
  const showPicker = shouldShowWalletPicker(phase, Boolean(connected && publicKey));
  const showOpen = !showProve && !showPicker && (!connected || !publicKey);
  const signEnabled = signButtonEnabled({
    connected: Boolean(connected && publicKey),
    hasPublicKey: Boolean(publicKey),
    canSign: authIssue !== 'unsupported' && Boolean(onSign),
    signing,
    status,
  });

  useEffect(() => {
    if (!connected || !publicKey) return;
    setPhase((current) => reduceWalletFlow(current, { type: 'context-connected' }));
  }, [connected, publicKey]);

  useEffect(() => {
    if (connected && publicKey) return;
    if (status === 'disconnected') {
      setPhase((current) => (current === 'wallet-picker' || current === 'connecting' ? current : 'idle'));
    }
  }, [connected, publicKey, status]);

  useEffect(() => {
    if (authIssue === 'rejected' || authIssue === 'invalid') {
      setPhase((current) => reduceWalletFlow(current, { type: 'sign-fail' }));
    }
  }, [authIssue]);

  useEffect(() => {
    if (!visible || !signEnabled) {
      if (!signEnabled) signEnabledLogged.current = false;
      return;
    }
    if (signEnabledLogged.current) return;
    signEnabledLogged.current = true;
    logGateTiming('Sign to enter enabled', `+${msSinceClick()}ms`);
  }, [visible, signEnabled]);

  if (!visible) return null;

  const thresholdLabel = mint
    ? formatTokenAmount(uiAmountToRaw(appConfig.accessThresholdUi, mint.decimals), mint.decimals)
    : appConfig.accessThresholdUi.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const carried =
    mint && balance
      ? `${formatTokenAmount(balance.totalRaw, mint.decimals)} / ${thresholdLabel} MHOOD`
      : null;

  function openPicker() {
    markInteractionClick();
    logGateTiming('Open the gate clicked');
    if (connected && publicKey) {
      setPhase((current) => reduceWalletFlow(current, { type: 'context-connected' }));
      logGateTiming('Sign to enter enabled', `+${msSinceClick()}ms`);
      return;
    }
    clearConnectError();
    setPickError(null);
    setPhase((current) => reduceWalletFlow(current, { type: 'open-picker' }));
    logGateTiming('wallet picker opened', `+${msSinceClick()}ms`);
  }

  async function pickWallet(entry: (typeof listed)[number]) {
    const { adapter, readyState } = entry;
    const action = resolveWalletClickAction({
      readyState,
      alreadyConnected: Boolean(connected && publicKey),
    });

    if (action === 'noop') {
      setPhase((current) => reduceWalletFlow(current, { type: 'connect-success' }));
      return;
    }

    if (action === 'install') {
      const message = formatWalletConnectError({ name: 'WalletNotReadyError' }, adapter.name);
      setPickError(message);
      devLog(`${adapter.name} connect error: ${message}`);
      if (adapter.url && typeof window !== 'undefined') {
        window.open(adapter.url, '_blank', 'noreferrer');
      }
      return;
    }

    if (inFlight.current || phase === 'connecting') return;

    markInteractionClick();
    logGateTiming(`${adapter.name} selected`);

    if (import.meta.env.DEV && !connectLogged.current) {
      connectLogged.current = true;
      console.info(`[MoginHood] wallet select: ${adapter.name}`);
      console.info(`[MoginHood] adapter ready state: ${readyState}`);
      console.info(
        `[MoginHood] adapter detected: ${readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable}`,
      );
      console.info(`[MoginHood] connect start: ${adapter.name}`);
      console.info(`[MoginHood] popup/request: calling wallet context connect() from user click`);
    }

    clearConnectError();
    setPickError(null);
    setPhase((current) => reduceWalletFlow(current, { type: 'connect-start' }));

    try {
      await connectWalletOnce({
        inFlight,
        walletName: adapter.name,
        selectedName: wallet?.adapter.name ?? null,
        alreadyConnected: Boolean(connected && publicKey),
        adapterConnected: Boolean(connected && publicKey),
        select: (name) => select(name as WalletName),
        commitSelect: (fn) => flushSync(fn),
        connect: () => connectRef.current(),
      });
      if (import.meta.env.DEV) {
        const selectedAdapter = walletRef.current?.adapter ?? adapter;
        console.info(`[MoginHood] connect success: ${adapter.name}`);
        console.info(`[MoginHood] connected wallet name: ${selectedAdapter.name}`);
        console.info(`[MoginHood] connected adapter class: ${getAdapterClassName(selectedAdapter)}`);
        logGateTiming('wallet connected', selectedAdapter.name);
      }
      setPhase((current) => reduceWalletFlow(current, { type: 'connect-success' }));
    } catch (err) {
      connectLogged.current = false;
      const message = formatWalletConnectError(
        err && typeof err === 'object' ? (err as { name?: string; message?: string }) : {},
        adapter.name,
      );
      if (import.meta.env.DEV) {
        console.info(`[MoginHood] connect error: ${adapter.name}`, err);
      }
      setPhase((current) => reduceWalletFlow(current, { type: 'connect-error' }));
      if (!/reject|cancel|decline/i.test(message)) {
        setPickError(message);
        devLog(`${adapter.name} connect error: ${message}`);
      }
    }
  }

  return (
    <div
      className="gate-shell is-interactive"
      data-wallet-interactive="true"
      data-wallet-visible="true"
    >
      <div className="gate-card">
        <p className="gate-kicker">Gate II</p>
        <h1 className="gate-title">{showProve ? COPY.proveClaim : COPY.gateLine}</h1>

        {showProve ? <p className="gate-sub">{COPY.proveClaimSub}</p> : null}

        {showOpen ? (
          <button type="button" className="forest-button" disabled={connectingThisWallet} onClick={openPicker}>
            {connectingThisWallet || connecting ? 'Connecting…' : 'Open the gate'}
          </button>
        ) : null}

        {showPicker ? (
          <ul className="wallet-picker">
            {listed.map((item) => (
              <li key={item.adapter.name}>
                <button
                  type="button"
                  className="wallet-picker__button"
                  disabled={connectingThisWallet}
                  onClick={() => void pickWallet(item)}
                >
                  <span>{item.adapter.name}</span>
                  {isReadyLabel(item.readyState) ? <span className="wallet-picker__detected">Detected</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {connectingThisWallet ? <p className="gate-status">Connecting…</p> : null}

        {pickError || connectError ? <p className="gate-error">{pickError || connectError}</p> : null}

        {showProve ? (
          <AuthStep
            authIssue={authIssue}
            signing={signing}
            enabled={signEnabled}
            onSign={() => {
              markInteractionClick();
              logGateTiming('Sign to enter clicked', `+${msSinceClick()}ms`);
              setPhase((current) => reduceWalletFlow(current, { type: 'sign-start' }));
              onSign?.();
            }}
          />
        ) : null}

        {connected && status === 'checking' ? (
          <p className="gate-status">The forest is listening…</p>
        ) : null}

        {connected && status === 'granted' ? (
          <p className="gate-status">The forest opens…</p>
        ) : null}

        {connected && status === 'insufficient' && carried ? (
          <div className="gate-denied">
            <p className="gate-whisper">{COPY.insufficient}</p>
            <p className="gate-balance">{carried}</p>
            <button type="button" className="forest-button forest-button--ghost" onClick={() => void disconnect()}>
              Close the gate
            </button>
          </div>
        ) : null}

        {connected && status === 'error' ? (
          <div className="gate-denied">
            <p className="gate-whisper">{error ?? COPY.rpcUnavailable}</p>
            {errorDetail ? <p className="muted">{errorDetail}</p> : null}
            <button type="button" className="forest-button" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isReadyLabel(readyState: WalletReadyState): boolean {
  return readyState === WalletReadyState.Installed;
}

function AuthStep({
  authIssue,
  signing,
  enabled,
  onSign,
}: {
  authIssue: AuthIssue | null;
  signing: boolean;
  enabled: boolean;
  onSign?: () => void;
}) {
  if (authIssue === 'unsupported') {
    return <p className="gate-whisper">{COPY.cannotSign}</p>;
  }

  if (authIssue === 'rejected' || authIssue === 'invalid') {
    return (
      <div className="gate-denied">
        <p className="gate-whisper">{COPY.forestClosed}</p>
        <button type="button" className="forest-button" disabled={signing || !onSign} onClick={() => onSign?.()}>
          {COPY.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="forest-button" disabled={!enabled} onClick={() => onSign?.()}>
      {signing ? 'Waiting for wallet…' : COPY.signToEnter}
    </button>
  );
}
