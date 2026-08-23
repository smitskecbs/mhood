import { COPY } from '../../config/constants';
import { formatDeniedBalance, formatDeniedRequired } from '../../utils/deniedCopy';

type AccessDeniedSceneProps = {
  visible: boolean;
  balanceLabel: string | null;
  thresholdLabel: string;
  onTryAnotherWallet: () => void;
  onDisconnect: () => void;
};

export function AccessDeniedScene({
  visible,
  balanceLabel,
  thresholdLabel,
  onTryAnotherWallet,
  onDisconnect,
}: AccessDeniedSceneProps) {
  if (!visible) return null;

  return (
    <div className="denied-overlay" data-testid="denied-overlay">
      <div className="denied-copy">
        <h1 className="denied-title">{COPY.insufficient}</h1>
        <p className="denied-sub">{COPY.insufficientSub}</p>
        <p className="denied-meta">{formatDeniedRequired(thresholdLabel)}</p>
        {balanceLabel ? <p className="denied-balance">{formatDeniedBalance(balanceLabel)}</p> : null}
        <div className="denied-actions">
          <button type="button" className="forest-button" onClick={onTryAnotherWallet}>
            {COPY.tryAnotherWallet}
          </button>
          <button type="button" className="forest-button forest-button--ghost" onClick={onDisconnect}>
            {COPY.disconnectWallet}
          </button>
        </div>
      </div>
    </div>
  );
}
