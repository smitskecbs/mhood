import { BACKGROUNDS } from '../../config/constants';
import { useGateIICinematic } from '../../hooks/useGateIICinematic';
import { GateIIAtmosphere } from './GateIIAtmosphere';

type BackgroundLayersProps = {
  gateIIVisible: boolean;
  forestVisible: boolean;
  introActive: boolean;
  walletUiVisible?: boolean;
  denied?: boolean;
  blackout?: boolean;
  reducedMotion?: boolean;
  burnSuccessVisible?: boolean;
};

function FittedSceneBackground({
  className,
  src,
  visible,
}: {
  className: string;
  src: string;
  visible: boolean;
}) {
  return (
    <div className={`scene-bg scene-bg--fitted ${className} ${visible ? 'is-visible' : ''}`.trim()}>
      <div className="scene-bg__fill" style={{ backgroundImage: `url(${src})` }} />
      <div className="scene-bg__fit" style={{ backgroundImage: `url(${src})` }} />
    </div>
  );
}

export function BackgroundLayers({
  gateIIVisible,
  forestVisible,
  introActive,
  walletUiVisible = false,
  denied = false,
  blackout = false,
  reducedMotion = false,
  burnSuccessVisible = false,
}: BackgroundLayersProps) {
  const cinematicActive = !blackout && gateIIVisible && !forestVisible && !reducedMotion && !denied && !burnSuccessVisible;
  const living = cinematicActive && !walletUiVisible;
  const phase = useGateIICinematic(living);
  const displayPhase = living ? phase : 'idle';
  const flicker = !blackout && (introActive || denied) && !reducedMotion;
  const glitch = !blackout && (introActive || living) && !reducedMotion;
  const dimmerVisible = !blackout && !forestVisible && denied;
  const grainStrong = !blackout && (introActive || cinematicActive || denied || burnSuccessVisible);
  const veilVisible = living && displayPhase === 'fade';

  return (
    <div
      className={`scene-stack ${blackout ? 'is-blackout' : ''} ${denied ? 'is-denied' : ''} ${burnSuccessVisible ? 'is-burn-success' : ''} ${cinematicActive ? `gate2-${displayPhase}` : ''}`.trim()}
      aria-hidden="true"
      data-pointer-events="none"
      data-gate2-phase={cinematicActive ? displayPhase : undefined}
      data-denied={denied ? 'true' : undefined}
      data-wallet-blackout={blackout && walletUiVisible ? 'true' : undefined}
      data-burn-success={burnSuccessVisible ? 'true' : undefined}
    >
      <FittedSceneBackground
        className={`scene-bg--gate-i ${flicker ? 'is-flickering' : ''}`}
        src={BACKGROUNDS.gateI}
        visible={!blackout}
      />
      <FittedSceneBackground
        className={`scene-bg--gate-ii ${cinematicActive ? 'is-living' : ''}`}
        src={BACKGROUNDS.gateII}
        visible={gateIIVisible && !blackout}
      />
      <FittedSceneBackground
        className="scene-bg--forest"
        src={BACKGROUNDS.forest}
        visible={forestVisible && !blackout}
      />
      <FittedSceneBackground
        className={`scene-bg--burn-success ${burnSuccessVisible && !reducedMotion ? 'is-living' : ''}`}
        src={BACKGROUNDS.burnSuccess}
        visible={burnSuccessVisible && !blackout}
      />
      <div className={`scene-dimmer ${dimmerVisible ? 'is-visible' : ''} ${denied ? 'is-denied' : ''}`.trim()} />
      <div className="scene-vignette" />
      <div className={`scene-mist ${cinematicActive ? 'is-living' : ''}`} />
      {cinematicActive ? <GateIIAtmosphere phase={displayPhase} /> : null}
      <div className={`scene-grain ${grainStrong ? 'is-strong' : ''}`} />
      <div className={`scene-glitch ${glitch ? 'is-active' : ''} ${living ? 'is-living' : ''}`} />
      <div
        className={`scene-black-veil ${veilVisible ? 'is-visible' : ''}`}
        data-testid="scene-black-veil"
      />
    </div>
  );
}
