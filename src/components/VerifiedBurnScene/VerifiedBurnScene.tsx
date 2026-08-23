import { useState } from 'react';
import { COPY } from '../../config/constants';
import { appConfig } from '../../config/env';
import { shortenAddress } from '../../utils/format';
import { verifiedBurnExplorerUrl, type VerifiedBurnSuccess } from '../../utils/verifiedBurnScene';

type VerifiedBurnSceneProps = {
  success: VerifiedBurnSuccess;
  burnRank: number | null;
  reducedMotion?: boolean;
  onBackToForest: () => void;
};

export function VerifiedBurnScene({
  success,
  burnRank,
  reducedMotion = false,
  onBackToForest,
}: VerifiedBurnSceneProps) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = verifiedBurnExplorerUrl(success.signature, appConfig.explorerTxUrl);

  async function copySignature() {
    try {
      await navigator.clipboard.writeText(success.signature);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`burn-success ${reducedMotion ? 'is-reduced' : ''}`}
      data-testid="verified-burn-scene"
    >
      {!reducedMotion ? <div className="burn-success__pulse" aria-hidden="true" /> : null}
      {!reducedMotion ? (
        <div className="burn-success__embers" aria-hidden="true">
          <span className="burn-success__ember" />
          <span className="burn-success__ember" />
          <span className="burn-success__ember" />
          <span className="burn-success__ember" />
          <span className="burn-success__ember" />
          <span className="burn-success__ember" />
        </div>
      ) : null}
      <div className="burn-success__card">
        <p className="burn-success__kicker">{COPY.verifiedBurn}</p>
        <p className="burn-success__flame" aria-hidden="true">
          🔥
        </p>
        <p className="burn-success__amount">{success.amountUi} MHOOD</p>
        <p className="burn-success__burned">{COPY.burnedWord}</p>
        <p className="burn-success__label">{COPY.transactionSignature}</p>
        <p className="burn-success__signature">{shortenAddress(success.signature, 4)}</p>
        <button type="button" className="forest-button forest-button--ghost" onClick={() => void copySignature()}>
          {copied ? COPY.signatureCopied : COPY.copySignature}
        </button>
        <a className="forest-button" href={explorerUrl} target="_blank" rel="noopener noreferrer">
          {COPY.viewTransaction}
        </a>
        <p className="burn-success__status">{COPY.confirmedOnChain}</p>
        {burnRank != null ? <p className="burn-success__rank">Burn Rank #{burnRank}</p> : null}
        {success.persistence === 'inactive' ? (
          <p className="muted">{COPY.burnVerifiedPersistenceInactive}</p>
        ) : null}
        <button type="button" className="forest-button" onClick={onBackToForest}>
          {COPY.backToForest}
        </button>
      </div>
    </div>
  );
}
