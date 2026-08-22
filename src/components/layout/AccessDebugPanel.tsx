import { formatTokenAmount, uiAmountToRaw } from '../../utils/tokenAmount';
import { evaluateHolderGate } from '../../utils/access';
import { appConfig, isDevBypassGateEnabled, rpcLooksLikeMainnet } from '../../config/env';
import { isGateDebugEnabled } from '../../config/wallets';
import { thresholdRawFromMint } from '../../services/mhoodBalanceService';
import { redactRpcUrl } from '../../utils/devLog';
import type { AccessStatus, MintDetails, WalletMhoodBalance } from '../../types';

type AccessDebugPanelProps = {
  wallet: string | null;
  status: AccessStatus;
  mint: MintDetails | null;
  balance: WalletMhoodBalance | null;
  error: string | null;
  checking: boolean;
  authenticated?: boolean;
};

export function AccessDebugPanel({
  wallet,
  status,
  mint,
  balance,
  error,
  checking,
  authenticated = false,
}: AccessDebugPanelProps) {
  if (!isGateDebugEnabled()) return null;

  const thresholdRaw = mint ? thresholdRawFromMint(mint) : uiAmountToRaw(appConfig.accessThresholdUi, 6);
  const gate = balance && mint ? evaluateHolderGate(balance.totalRaw, thresholdRaw) : '—';
  const bypass = isDevBypassGateEnabled();

  return (
    <aside className="debug-panel" aria-label="Development holder gate debug">
      <p className="debug-panel__title">DEV gate</p>
      <dl>
        <div>
          <dt>Wallet</dt>
          <dd>{wallet ?? 'not connected'}</dd>
        </div>
        <div>
          <dt>Authenticated</dt>
          <dd>{authenticated ? 'yes' : 'no'}</dd>
        </div>
        <div>
          <dt>RPC</dt>
          <dd>
            {appConfig.rpcUrl ? redactRpcUrl(appConfig.rpcUrl) : '(unconfigured)'}
            {appConfig.rpcUrl && !rpcLooksLikeMainnet(appConfig.rpcUrl) ? ' (NOT MAINNET)' : ''}
          </dd>
        </div>
        <div>
          <dt>Mint</dt>
          <dd>{mint?.mint ?? appConfig.mintAddress}</dd>
        </div>
        <div>
          <dt>Token program</dt>
          <dd>{mint ? `${mint.tokenProgramKind} · ${mint.tokenProgramId}` : 'pending'}</dd>
        </div>
        <div>
          <dt>Decimals</dt>
          <dd>{mint ? String(mint.decimals) : 'pending'}</dd>
        </div>
        <div>
          <dt>Token accounts</dt>
          <dd>{balance ? String(balance.accounts.length) : checking ? 'checking' : '—'}</dd>
        </div>
        <div>
          <dt>Raw balance</dt>
          <dd>{balance ? balance.totalRaw.toString() : '—'}</dd>
        </div>
        <div>
          <dt>UI balance</dt>
          <dd>{balance && mint ? `${formatTokenAmount(balance.totalRaw, mint.decimals)} MHOOD` : '—'}</dd>
        </div>
        <div>
          <dt>Required</dt>
          <dd>
            {mint
              ? `${formatTokenAmount(thresholdRaw, mint.decimals)} MHOOD (${thresholdRaw.toString()} raw)`
              : `${appConfig.accessThresholdUi} MHOOD`}
          </dd>
        </div>
        <div>
          <dt>Gate</dt>
          <dd>
            {status} · {gate}
            {bypass ? ' · BYPASS ON' : ''}
          </dd>
        </div>
        {error ? (
          <div>
            <dt>RPC error</dt>
            <dd>{error}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
