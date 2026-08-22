import { useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { COPY } from '../../config/constants';
import { appConfig, isRealBurnEnabled } from '../../config/env';
import {
  assertBurnSafety,
  buildBurnTransaction,
  formatBurnDevCategory,
  formatBurnUserError,
  prepareBurn,
  RealBurnDisabledError,
  shouldRefreshAfterVerifiedBurn,
  simulationResultMessage,
  submitAndVerifyBurn,
  walletCanSendTransactions,
} from '../../services/burnService';
import { fetchWalletMhoodBalance } from '../../services/mhoodBalanceService';
import { submitVerifiedBurnSignature } from '../../services/verifiedBurnClient';
import { burnErrorLog, burnLog } from '../../utils/burnLog';
import { explorerTxUrl, shortenAddress } from '../../utils/format';
import { formatTokenAmount, parseBurnAmountInput, percentOf } from '../../utils/tokenAmount';
import type { BurnErrorCategory, BurnExecutionResult, MintDetails, PreparedBurn, WalletMhoodBalance } from '../../types';
import { ForestPanel } from '../layout/ForestPanel';
import { Modal } from '../layout/Modal';

type BurnPanelProps = {
  mint: MintDetails;
  balance: WalletMhoodBalance;
  onRefreshAfterRealBurn: () => Promise<void>;
};

const PERCENTS = [25, 50, 75] as const;

export function BurnPanel({ mint, balance, onRefreshAfterRealBurn }: BurnPanelProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [input, setInput] = useState('');
  const [confirming, setConfirming] = useState<PreparedBurn | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BurnExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<BurnErrorCategory | null>(null);
  const realEnabled = isRealBurnEnabled();

  const parsed = useMemo(() => {
    if (!input.trim()) return { raw: 0n, valid: false, message: '' };
    try {
      const raw = parseBurnAmountInput(input, mint.decimals, balance.totalRaw);
      return { raw, valid: true, message: '' };
    } catch (err) {
      return { raw: 0n, valid: false, message: err instanceof Error ? err.message : 'Invalid amount' };
    }
  }, [input, mint.decimals, balance.totalRaw]);

  function applyPercent(percent: number) {
    const raw = percentOf(balance.totalRaw, percent);
    if (raw <= 0n) return;
    setInput(formatTokenAmount(raw, mint.decimals).replace(/,/g, ''));
  }

  function openConfirm() {
    setError(null);
    setErrorCategory(null);
    try {
      assertBurnSafety(mint, parsed.raw, balance);
      const prepared = prepareBurn({
        wallet: balance.wallet,
        mint,
        accounts: balance.accounts,
        amountRaw: parsed.raw,
      });
      setConfirming(prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare burn');
      setErrorCategory('unknown');
    }
  }

  async function confirmBurn() {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    setErrorCategory(null);
    burnLog('burn requested');
    burnLog(`amount UI: ${confirming.amountUi}`);
    burnLog(`amount raw: ${confirming.amountRaw.toString()}`);
    burnLog(`real burn enabled: ${realEnabled}`);
    try {
      burnLog('account-fetch');
      const latest = await fetchWalletMhoodBalance(balance.wallet, { mintDetails: mint, connection });
      assertBurnSafety(mint, confirming.amountRaw, latest);
      const prepared = prepareBurn({
        wallet: latest.wallet,
        mint,
        accounts: latest.accounts,
        amountRaw: confirming.amountRaw,
      });
      burnLog(`token accounts found: ${latest.accounts.length}`);
      burnLog(
        'burn allocations: ' +
          prepared.allocations.map((item) => `${item.tokenAccount}:${item.amountRaw.toString()}`).join(', '),
      );

      if (!realEnabled) {
        const preparedTx = await buildBurnTransaction(prepared, connection);
        if (preparedTx.transaction.instructions.length === 0) {
          throw new Error('Simulation failed: no burn instructions were built');
        }
        setResult({
          mode: 'simulation',
          prepared,
          message: simulationResultMessage(prepared),
        });
        setConfirming(null);
        return;
      }

      if (!walletCanSendTransactions(wallet)) {
        throw new Error('Connected wallet cannot sign or send transactions.');
      }

      const sent = await submitAndVerifyBurn({
        prepared,
        connection,
        wallet: {
          connected: wallet.connected,
          publicKey: wallet.publicKey,
          sendTransaction: (transaction, connection, options) =>
            wallet.sendTransaction(transaction, connection, options),
          signTransaction: wallet.signTransaction
            ? async (transaction) => wallet.signTransaction!(transaction)
            : undefined,
          adapter: wallet.wallet?.adapter ?? null,
        },
        persist: submitVerifiedBurnSignature,
      });
      const next: BurnExecutionResult = {
        mode: 'real',
        prepared: sent.prepared,
        signature: sent.signature,
        verified: true,
        slot: sent.record.slot,
        timestamp: sent.record.timestamp,
        persistence: sent.persistence,
      };
      setResult(next);
      setConfirming(null);
      setInput('');
      if (shouldRefreshAfterVerifiedBurn(next)) {
        await onRefreshAfterRealBurn();
      }
    } catch (err) {
      if (err instanceof RealBurnDisabledError) {
        setResult({
          mode: 'simulation',
          prepared: err.prepared,
          message: simulationResultMessage(err.prepared),
        });
        setConfirming(null);
        return;
      }
      burnErrorLog(err instanceof Error && 'stage' in err ? String(err.stage) : 'unknown', err);
      setError(formatBurnUserError(err));
      setErrorCategory(formatBurnDevCategory(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForestPanel className="burn-panel" eyebrow="Return what the trees ask" title={COPY.burnTitle}>
      <p className="burn-prompt">{COPY.burnPrompt}</p>
      <p className={`mode-pill ${realEnabled ? 'mode-pill--danger' : 'mode-pill--safe'}`}>
        {realEnabled ? 'REAL BURN ENABLED' : 'Development / Simulation — no tokens will be burned'}
      </p>
      <p className="stat-label">Wallet MHOOD balance</p>
      <p className="stat-value">{formatTokenAmount(balance.totalRaw, mint.decimals)} MHOOD</p>

      <label className="burn-input-label" htmlFor="burn-amount">
        Amount
      </label>
      <input
        id="burn-amount"
        className="burn-input"
        inputMode="decimal"
        placeholder="0"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      <div className="percent-row">
        {PERCENTS.map((percent) => (
          <button key={percent} type="button" className="forest-button forest-button--ghost" onClick={() => applyPercent(percent)}>
            {percent}%
          </button>
        ))}
        <button type="button" className="forest-button forest-button--ghost" onClick={() => applyPercent(100)}>
          MAX
        </button>
      </div>

      {parsed.valid ? (
        <p className="burn-preview">Burn {formatTokenAmount(parsed.raw, mint.decimals)} MHOOD</p>
      ) : (
        <p className="muted">{parsed.message || 'Choose an amount to return.'}</p>
      )}
      {error ? (
        <div className="gate-error">
          <p>{error}</p>
          {import.meta.env.DEV && errorCategory ? <p className="muted">{errorCategory}</p> : null}
        </div>
      ) : null}

      <button type="button" className="forest-button" disabled={!parsed.valid || busy} onClick={openConfirm}>
        {realEnabled ? 'Burn MHOOD' : 'Simulate burn'}
      </button>

      <Modal
        open={Boolean(confirming)}
        title={COPY.burnConfirmTitle}
        onClose={() => (busy ? undefined : setConfirming(null))}
      >
        {confirming ? (
          <>
            <p>You are about to permanently burn {confirming.amountUi} MHOOD.</p>
            <p className="warning">{COPY.burnIrreversible}</p>
            {!realEnabled ? (
              <p className="mode-pill mode-pill--safe">
                Simulation only. Your wallet will not be asked to sign, and no tokens will be destroyed.
              </p>
            ) : (
              <p>Your wallet will ask you to approve this transaction.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="forest-button forest-button--ghost" disabled={busy} onClick={() => setConfirming(null)}>
                Step back
              </button>
              <button type="button" className="forest-button" disabled={busy} onClick={() => void confirmBurn()}>
                {busy ? 'Working…' : COPY.confirmBurn}
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(result)}
        title={result?.mode === 'real' ? COPY.burnSuccessTitle : 'SIMULATED RETURN'}
        onClose={() => setResult(null)}
      >
        {result?.mode === 'simulation' ? (
          <>
            <p>This was a simulation. No MHOOD was burned.</p>
            <p>{result.message}</p>
            <p className="muted">
              Prepared {result.prepared.instructionCount} official burn-checked instruction(s) for {result.prepared.amountUi} MHOOD.
            </p>
            <button type="button" className="forest-button" onClick={() => setResult(null)}>
              Remain here
            </button>
          </>
        ) : null}
        {result?.mode === 'real' ? (
          <>
            <p className="mode-pill mode-pill--safe">{COPY.verifiedBurn}</p>
            <p>{result.prepared.amountUi} MHOOD has been permanently burned.</p>
            {result.persistence === 'inactive' ? (
              <p className="muted">{COPY.burnVerifiedPersistenceInactive}</p>
            ) : null}
            <p className="muted">Signature: {shortenAddress(result.signature, 6)}</p>
            {result.timestamp ? (
              <p className="muted">Time: {new Date(result.timestamp * 1000).toLocaleString()}</p>
            ) : null}
            <p>
              <a className="explorer-link" href={explorerTxUrl(appConfig.explorerTxUrl, result.signature)} target="_blank" rel="noreferrer">
                View on explorer
              </a>
            </p>
            <button type="button" className="forest-button" onClick={() => setResult(null)}>
              Return to the grove
            </button>
          </>
        ) : null}
      </Modal>
    </ForestPanel>
  );
}
