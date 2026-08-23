import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { COPY } from '../config/constants';
import { appConfig, isRealBurnEnabled, formatMintForLog } from '../config/env';
import { gateWalletUiDelayMs, getCinematicTiming } from '../config/timing';
import { AccessDeniedScene } from '../components/AccessDenied/AccessDeniedScene';
import { BackgroundLayers } from '../components/cinematic/BackgroundLayers';
import { ForestDashboard } from '../components/ForestDashboard/ForestDashboard';
import { AccessDebugPanel } from '../components/layout/AccessDebugPanel';
import { VerifiedBurnScene } from '../components/VerifiedBurnScene/VerifiedBurnScene';
import { WalletGate } from '../components/WalletGate/WalletGate';
import { useBurnRanking } from '../hooks/useBurnRanking';
import { useForestAccess } from '../hooks/useForestAccess';
import { useHolderRanking } from '../hooks/useHolderRanking';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { findBurnRank } from '../services/burnRankingService';
import { clearMintCache } from '../services/solana/mintService';
import { formatTokenAmount, uiAmountToRaw } from '../utils/tokenAmount';
import { sceneActionForAccess, sceneVisualState } from '../utils/sceneVisibility';
import { logWalletUiReady, markGateIIStart } from '../utils/gateTiming';
import { resetHolderVerification } from '../utils/walletInteraction';
import type { VerifiedBurnSuccess } from '../utils/verifiedBurnScene';
import type { ForestScene } from '../types';

export function ForestApp() {
  const reducedMotion = usePrefersReducedMotion();
  const timing = useMemo(() => getCinematicTiming(reducedMotion), [reducedMotion]);
  const access = useForestAccess();
  const { disconnect } = useWallet();
  const { status, wallet, mint, balance, error, errorDetail, refresh, connecting, authenticate, signing, authIssue } = access;
  const holders = useHolderRanking(mint, status === 'granted');
  const burns = useBurnRanking(mint);
  const [scene, setScene] = useState<ForestScene>('intro');
  const [gateIIVisible, setGateIIVisible] = useState(false);
  const [forestVisible, setForestVisible] = useState(false);
  const [preferPicker, setPreferPicker] = useState(false);
  const [verifiedBurn, setVerifiedBurn] = useState<VerifiedBurnSuccess | null>(null);
  const visuals = sceneVisualState(scene);

  const thresholdLabel = mint
    ? formatTokenAmount(uiAmountToRaw(appConfig.accessThresholdUi, mint.decimals), mint.decimals)
    : appConfig.accessThresholdUi.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const deniedBalanceLabel = mint && balance ? formatTokenAmount(balance.totalRaw, mint.decimals) : null;

  useEffect(() => {
    console.info(`[MoginHood] MHOOD mint configured: ${formatMintForLog(appConfig.mintAddress)}`);
    if (!import.meta.env.DEV) return;
    console.info(`[MoginHood] real burn enabled: ${isRealBurnEnabled()}`);
  }, []);

  useEffect(() => {
    if (scene !== 'intro') return;
    const hold = window.setTimeout(() => setScene('gateDwell'), timing.introHoldMs);
    return () => window.clearTimeout(hold);
  }, [scene, timing.introHoldMs]);

  useEffect(() => {
    if (scene !== 'gateDwell') return;
    markGateIIStart();
    setGateIIVisible(true);
    const reveal = window.setTimeout(() => setScene('gate'), gateWalletUiDelayMs(timing));
    return () => window.clearTimeout(reveal);
  }, [scene, timing]);

  useEffect(() => {
    if (scene !== 'gate') return;
    logWalletUiReady();
  }, [scene]);

  useEffect(() => {
    if (status === 'awaiting_signature' || status === 'checking' || status === 'granted') {
      setPreferPicker(false);
    }
  }, [status]);

  useEffect(() => {
    if (scene === 'intro' || scene === 'gateDwell') return;

    const action = sceneActionForAccess({
      scene,
      status,
      hasWallet: Boolean(wallet),
    });

    if (action === 'denied') {
      setForestVisible(false);
      if (scene === 'denied') return;
      const hide = window.setTimeout(() => setScene('denied'), timing.walletUiFadeMs);
      return () => window.clearTimeout(hide);
    }

    if (action === 'gate') {
      setVerifiedBurn(null);
      setForestVisible(false);
      setScene('gate');
      return;
    }

    if (action === 'granted') {
      if (scene === 'granted') return;
      const hide = window.setTimeout(() => setScene('granted'), timing.walletUiFadeMs);
      return () => window.clearTimeout(hide);
    }
  }, [status, wallet, scene, timing.walletUiFadeMs]);

  useEffect(() => {
    if (scene !== 'granted') return;
    setForestVisible(false);
    const hold = window.setTimeout(() => setScene('forestDwell'), timing.accessGrantedMs);
    return () => window.clearTimeout(hold);
  }, [scene, timing.accessGrantedMs]);

  useEffect(() => {
    if (scene !== 'forestDwell') return;
    setForestVisible(true);
    const enter = window.setTimeout(() => setScene('forest'), timing.forestDwellMs);
    return () => window.clearTimeout(enter);
  }, [scene, timing.forestDwellMs]);

  const showForestUi = visuals.showForestUi && status === 'granted' && mint && balance;

  async function refreshAll() {
    clearMintCache();
    await refresh();
    await Promise.all([holders.refresh({ bypassCache: true }), burns.refresh()]);
  }

  function openVerifiedBurnScene(success: VerifiedBurnSuccess) {
    setVerifiedBurn(success);
    setForestVisible(false);
  }

  function returnToForestFromBurn() {
    setVerifiedBurn(null);
    if (scene === 'forest') {
      setForestVisible(true);
    }
    void refreshAll();
  }

  function advanceIntro() {
    setScene((current) => (current === 'intro' ? 'gateDwell' : current));
  }

  function returnToWalletPicker() {
    resetHolderVerification();
    setPreferPicker(true);
    void disconnect();
  }

  function disconnectDeniedWallet() {
    resetHolderVerification();
    setPreferPicker(false);
    void disconnect();
  }

  return (
    <main
      className={`app-root${verifiedBurn ? ' is-burn-success' : ''}`}
      style={{ ['--wallet-ui-fade-ms' as string]: `${timing.walletUiFadeMs}ms` }}
    >
      <BackgroundLayers
        introActive={visuals.introActive}
        reducedMotion={reducedMotion}
        gateIIVisible={gateIIVisible && visuals.gateIIVisible}
        walletUiVisible={visuals.walletUiVisible}
        denied={visuals.denied}
        forestVisible={forestVisible && visuals.forestBackground}
        burnSuccessVisible={Boolean(verifiedBurn)}
        blackout={visuals.blackout}
      />

      {!visuals.showGranted && !isRealBurnEnabled() ? (
        <div className="dev-ribbon">Simulation mode — real burns locked</div>
      ) : null}

      {scene === 'intro' ? (
        <button type="button" className="intro-advance" onClick={advanceIntro}>
          <span className="sr-only">Continue</span>
        </button>
      ) : null}

      <WalletGate
        visible={visuals.showGateUi}
        preferPicker={preferPicker}
        leaving={(status === 'insufficient' || status === 'granted') && scene === 'gate'}
        status={status}
        mint={mint}
        balance={balance}
        error={error}
        errorDetail={errorDetail}
        connecting={connecting}
        signing={signing}
        authIssue={authIssue}
        onRetry={() => void refresh()}
        onSign={() => void authenticate()}
      />

      <AccessDeniedScene
        visible={visuals.showDenied}
        balanceLabel={deniedBalanceLabel}
        thresholdLabel={thresholdLabel}
        onTryAnotherWallet={returnToWalletPicker}
        onDisconnect={disconnectDeniedWallet}
      />

      {visuals.showGranted ? (
        <div className="granted-overlay" data-testid="granted-overlay">
          <p className="granted-text">{COPY.granted}</p>
        </div>
      ) : null}

      {showForestUi && mint && balance ? (
        <ForestDashboard
          visible
          mint={mint}
          balance={balance}
          holderSnapshot={holders.snapshot}
          holderLoading={holders.loading}
          holderError={holders.error}
          onRetryHolders={() => void holders.refresh({ bypassCache: true })}
          burnSnapshot={burns.snapshot}
          burnLoading={burns.loading}
          burnError={burns.error}
          onRefreshAll={refreshAll}
          onVerifiedBurnSuccess={openVerifiedBurnScene}
        />
      ) : null}

      {verifiedBurn && status === 'granted' && scene === 'forest' ? (
        <VerifiedBurnScene
          success={verifiedBurn}
          burnRank={findBurnRank(burns.snapshot, verifiedBurn.wallet)}
          reducedMotion={reducedMotion}
          onBackToForest={returnToForestFromBurn}
        />
      ) : null}

      {!visuals.showGranted ? (
        <AccessDebugPanel
          wallet={wallet}
          status={status}
          mint={mint}
          balance={balance}
          error={error}
          checking={access.checking}
          authenticated={access.authenticated}
        />
      ) : null}
    </main>
  );
}
