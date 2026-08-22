import { useEffect, useMemo, useState } from 'react';
import { COPY } from '../config/constants';
import { isRealBurnEnabled, formatMintForLog, appConfig } from '../config/env';
import { gateWalletUiDelayMs, getCinematicTiming } from '../config/timing';
import { BackgroundLayers } from '../components/cinematic/BackgroundLayers';
import { ForestDashboard } from '../components/ForestDashboard/ForestDashboard';
import { AccessDebugPanel } from '../components/layout/AccessDebugPanel';
import { WalletGate } from '../components/WalletGate/WalletGate';
import { useBurnRanking } from '../hooks/useBurnRanking';
import { useForestAccess } from '../hooks/useForestAccess';
import { useHolderRanking } from '../hooks/useHolderRanking';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { clearMintCache } from '../services/solana/mintService';
import { sceneVisualState } from '../utils/sceneVisibility';
import { logWalletUiReady, markGateIIStart } from '../utils/gateTiming';
import type { ForestScene } from '../types';

export function ForestApp() {
  const reducedMotion = usePrefersReducedMotion();
  const timing = useMemo(() => getCinematicTiming(reducedMotion), [reducedMotion]);
  const access = useForestAccess();
  const { status, wallet, mint, balance, error, errorDetail, refresh, connecting, authenticate, signing, authIssue } = access;
  const holders = useHolderRanking(mint, status === 'granted');
  const burns = useBurnRanking(mint);
  const [scene, setScene] = useState<ForestScene>('intro');
  const [gateIIVisible, setGateIIVisible] = useState(false);
  const [forestVisible, setForestVisible] = useState(false);
  const visuals = sceneVisualState(scene);

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
    if (scene === 'intro' || scene === 'gateDwell') return;

    if (status !== 'granted' || !wallet) {
      setForestVisible(false);
      if (scene === 'forest' || scene === 'forestDwell' || scene === 'granted') {
        setScene('gate');
      }
      return;
    }

    if (scene !== 'gate') return;
    setScene('granted');
  }, [status, wallet, scene]);

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

  function advanceIntro() {
    setScene((current) => (current === 'intro' ? 'gateDwell' : current));
  }

  return (
    <main className="app-root" style={{ ['--wallet-ui-fade-ms' as string]: `${timing.walletUiFadeMs}ms` }}>
      <BackgroundLayers
        introActive={visuals.introActive}
        reducedMotion={reducedMotion}
        gateIIVisible={gateIIVisible && visuals.gateIIVisible}
        walletUiVisible={visuals.walletUiVisible}
        forestVisible={forestVisible && visuals.forestBackground}
        blackout={visuals.blackout}
      />

      {!visuals.blackout && !isRealBurnEnabled() ? (
        <div className="dev-ribbon">Simulation mode — real burns locked</div>
      ) : null}

      {scene === 'intro' ? (
        <button type="button" className="intro-advance" onClick={advanceIntro}>
          <span className="sr-only">Continue</span>
        </button>
      ) : null}

      <WalletGate
        visible={visuals.showGateUi}
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
        />
      ) : null}

      {!visuals.blackout ? (
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
