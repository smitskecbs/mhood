import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccessStatus, MintDetails, WalletMhoodBalance } from '../types';
import { BALANCE_REFRESH_MS } from '../config/constants';
import { appConfig, isDevBypassGateEnabled, requireConfiguredRpcUrl } from '../config/env';
import { fetchMintDetails } from '../services/solana/mintService';
import { getConnection } from '../services/solana/connection';
import { fetchWalletMhoodBalance, thresholdRawFromMint } from '../services/mhoodBalanceService';
import { accessAfterWalletChange, evaluateHolderGate, resolveAccessStatus } from '../utils/access';
import { formatTokenAmount } from '../utils/tokenAmount';
import { devLog, formatHolderRpcError, formatRpcError, redactRpcUrl } from '../utils/devLog';
import { shouldStartSingleHolderVerification, claimHolderVerification, resetHolderVerification } from '../utils/walletInteraction';
import {
  buildForestAccessMessage,
  createAuthNonce,
  encodeUtf8,
  isSignatureUserRejection,
  resolveAuthOrigin,
  resolveSignMessage,
  shouldStartHolderCheck,
  toUint8Array,
  type AuthIssue,
  verifyEd25519Signature,
  walletCanSignMessage,
} from '../utils/walletAuth';

export function useForestAccess() {
  const { publicKey, connected, connecting, disconnecting, signMessage, wallet } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const previousWallet = useRef<string | null>(null);
  const [mint, setMint] = useState<MintDetails | null>(null);
  const [balance, setBalance] = useState<WalletMhoodBalance | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authIssue, setAuthIssue] = useState<AuthIssue | null>(null);
  const [signing, setSigning] = useState(false);
  const requestId = useRef(0);
  const holderStartedFor = useRef<string | null>(null);

  const signerSupported = walletCanSignMessage(signMessage, wallet?.adapter);
  const displayAuthIssue: AuthIssue | null =
    connected && walletAddress && !signerSupported ? 'unsupported' : authIssue;

  const refresh = useCallback(
    async (options?: { recheck?: boolean }): Promise<WalletMhoodBalance | null> => {
      if (
        !walletAddress ||
        !shouldStartHolderCheck({
          connected: Boolean(connected),
          publicKey: walletAddress,
          authenticated,
        })
      ) {
        setChecking(false);
        return null;
      }

      const id = ++requestId.current;
      setChecking(true);
      setError(null);
      setErrorDetail(null);
      if (import.meta.env.DEV) {
        console.info('[MoginHood] starting holder verification');
      }

      try {
        requireConfiguredRpcUrl();
        const connection = getConnection();
        const mintDetails = await fetchMintDetails(connection);
        if (id !== requestId.current) return null;
        setMint(mintDetails);

        let result = await fetchWalletMhoodBalance(walletAddress, { mintDetails, connection });
        if (id !== requestId.current) return null;

        if (options?.recheck && result.meetsAccessThreshold) {
          result = await fetchWalletMhoodBalance(walletAddress, { mintDetails, connection });
          if (id !== requestId.current) return null;
        }

        setBalance(result);
        const thresholdRaw = thresholdRawFromMint(mintDetails);
        const gate = evaluateHolderGate(result.totalRaw, thresholdRaw);
        devLog(options?.recheck ? 'gate recheck' : 'holder verification', {
          publicKey: walletAddress,
          rpc: redactRpcUrl(appConfig.rpcUrl || '(unconfigured)'),
          tokenAccounts: result.accounts.length,
          rawBalance: result.totalRaw.toString(),
          uiBalance: formatTokenAmount(result.totalRaw, mintDetails.decimals),
          gate,
        });
        return result;
      } catch (err) {
        if (id !== requestId.current) return null;
        const view = formatHolderRpcError(err);
        setError(view.title);
        setErrorDetail(view.detail ?? null);
        setBalance(null);
        devLog('RPC error', {
          publicKey: walletAddress,
          rpc: redactRpcUrl(appConfig.rpcUrl || '(unconfigured)'),
          error: formatRpcError(err),
        });
        return null;
      } finally {
        if (id === requestId.current) {
          setChecking(false);
        }
      }
    },
    [walletAddress, connected, authenticated],
  );

  const authenticate = useCallback(async () => {
    if (!publicKey || !connected || !walletAddress) return;

    const sign = resolveSignMessage(signMessage, wallet?.adapter);
    if (!sign) {
      setAuthenticated(false);
      setAuthIssue('unsupported');
      return;
    }

    const nonce = createAuthNonce();
    const issuedAt = new Date().toISOString();
    const message = buildForestAccessMessage({
      wallet: walletAddress,
      nonce,
      issuedAt,
      origin: resolveAuthOrigin(),
    });
    const messageBytes = toUint8Array(encodeUtf8(message));

    if (import.meta.env.DEV) {
      console.info('[MoginHood] requesting message signature');
      console.info('[MoginHood] sign message requested');
    }

    setSigning(true);
    setAuthIssue(null);
    try {
      const signature = toUint8Array(await sign(messageBytes));
      if (import.meta.env.DEV) {
        console.info('[MoginHood] signature received');
      }
      const verified = verifyEd25519Signature({
        messageBytes,
        signature,
        publicKeyBytes: toUint8Array(publicKey.toBytes()),
      });
      if (import.meta.env.DEV) {
        console.info(`[MoginHood] signature verified: ${verified}`);
      }
      if (!verified) {
        setAuthenticated(false);
        setAuthIssue('invalid');
        return;
      }
      setAuthenticated(true);
      setAuthIssue(null);
    } catch (err) {
      setAuthenticated(false);
      if (isSignatureUserRejection(err)) {
        if (import.meta.env.DEV) {
          console.info('[MoginHood] signature rejected');
        }
        setAuthIssue('rejected');
        return;
      }
      if (import.meta.env.DEV) {
        console.info('[MoginHood] signature verified: false');
      }
      setAuthIssue('invalid');
    } finally {
      setSigning(false);
    }
  }, [publicKey, connected, walletAddress, signMessage, wallet]);

  useEffect(() => {
    const change = accessAfterWalletChange(previousWallet.current, walletAddress);
    const identityChanged = previousWallet.current !== walletAddress;
    previousWallet.current = walletAddress;

    if (change.clearAuth) {
      setAuthenticated(false);
      setAuthIssue(null);
      setSigning(false);
    }
    if (change.clearBalance) {
      setBalance(null);
      setError(null);
      setErrorDetail(null);
    }

    if (identityChanged) {
      setChecking(false);
      requestId.current += 1;
      holderStartedFor.current = null;
      resetHolderVerification();
      if (!walletAddress) {
        devLog('wallet disconnected');
      }
      return;
    }

    if (
      !shouldStartHolderCheck({
        connected: Boolean(walletAddress && connected),
        publicKey: walletAddress,
        authenticated,
      })
    ) {
      setChecking(false);
      if (!authenticated) {
        holderStartedFor.current = null;
        resetHolderVerification();
      }
      return;
    }

    if (
      !walletAddress ||
      !shouldStartSingleHolderVerification({
        wallet: walletAddress,
        authenticated,
        alreadyStartedFor: holderStartedFor.current,
      }) ||
      !claimHolderVerification(walletAddress)
    ) {
      return;
    }

    holderStartedFor.current = walletAddress;
    void refresh();
  }, [walletAddress, connected, authenticated, refresh]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!connected || !walletAddress || !wallet || authenticated) return;
    console.info('[MoginHood] authentication awaiting signature');
  }, [connected, walletAddress, wallet, authenticated]);

  useEffect(() => {
    if (
      !shouldStartHolderCheck({
        connected: Boolean(walletAddress && connected),
        publicKey: walletAddress,
        authenticated,
      })
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, BALANCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [walletAddress, connected, authenticated, refresh]);

  const bypass = isDevBypassGateEnabled();
  const status: AccessStatus = resolveAccessStatus({
    connected: Boolean(walletAddress && connected),
    authenticated,
    checking,
    error,
    meetsThreshold: balance ? balance.meetsAccessThreshold : null,
  });

  return {
    wallet: walletAddress,
    connected: Boolean(walletAddress && connected),
    connecting,
    disconnecting,
    status,
    mint,
    balance,
    checking,
    error,
    errorDetail,
    refresh,
    authenticate,
    signing,
    authenticated,
    authIssue: displayAuthIssue,
    bypass,
  };
}
