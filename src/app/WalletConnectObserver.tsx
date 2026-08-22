import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { devLog } from '../utils/devLog';

/**
 * Development-only observer. Connect is invoked from the wallet picker click
 * (user gesture) so the extension popup can open. Never connects on page load.
 */
export function WalletConnectObserver() {
  const { wallet, connected, connecting, publicKey } = useWallet();
  const lastName = useRef<string | null>(null);
  const loggedConnectedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!wallet) {
      lastName.current = null;
      loggedConnectedFor.current = null;
      return;
    }

    const name = wallet.adapter.name;
    const readyState = wallet.readyState;
    const detected =
      readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable;

    if (lastName.current !== name) {
      lastName.current = name;
      loggedConnectedFor.current = null;
      console.info(`[MoginHood] selected wallet: ${name}`);
      console.info(`[MoginHood] adapter ready state: ${readyState}`);
      console.info(`[MoginHood] adapter detected: ${detected}`);
    } else if (connecting && lastName.current === name) {
      return;
    }
  }, [wallet, connecting]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!connected || !publicKey || !wallet) return;
    const key = `${wallet.adapter.name}:${publicKey.toBase58()}`;
    if (loggedConnectedFor.current === key) return;
    loggedConnectedFor.current = key;
    console.info(`[MoginHood] wallet connected: ${wallet.adapter.name}`);
    devLog('wallet public key ready', { wallet: wallet.adapter.name });
  }, [connected, publicKey, wallet]);

  return null;
}
