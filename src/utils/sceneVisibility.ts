import type { AccessStatus, ForestScene } from '../types';

export type SceneVisualState = {
  blackout: boolean;
  showGateUi: boolean;
  showGranted: boolean;
  showDenied: boolean;
  denied: boolean;
  showForestUi: boolean;
  introActive: boolean;
  gateIIVisible: boolean;
  walletUiVisible: boolean;
  walletUiInteractive: boolean;
  forestBackground: boolean;
};

export type AccessSceneAction = 'none' | 'denied' | 'gate' | 'granted';

export function sceneVisualState(scene: ForestScene): SceneVisualState {
  const granted = scene === 'granted';
  const denied = scene === 'denied';
  const gate = scene === 'gate';
  const forest = scene === 'forestDwell' || scene === 'forest' || scene === 'forestEntry';
  return {
    blackout: granted || gate,
    showGateUi: gate,
    showGranted: granted,
    showDenied: denied,
    denied,
    showForestUi: scene === 'forest',
    introActive: scene === 'intro',
    gateIIVisible: scene === 'gateDwell',
    walletUiVisible: gate,
    walletUiInteractive: gate,
    forestBackground: forest,
  };
}

export function grantedSceneIsBlack(visuals: SceneVisualState): boolean {
  return visuals.blackout && visuals.showGranted && !visuals.forestBackground && !visuals.showGateUi;
}

export function walletSceneIsBlack(visuals: SceneVisualState): boolean {
  return (
    visuals.blackout &&
    visuals.showGateUi &&
    visuals.walletUiVisible &&
    !visuals.gateIIVisible &&
    !visuals.forestBackground &&
    !visuals.showGranted &&
    !visuals.denied
  );
}

export function deniedSceneUsesBackground1(visuals: SceneVisualState): boolean {
  return visuals.denied && visuals.showDenied && !visuals.blackout && !visuals.gateIIVisible && !visuals.forestBackground;
}

/**
 * Scene changes driven by holder/auth status. Does not touch intro/gateDwell timing
 * or the ACCESS GRANTED hold — those stay on their existing timers.
 */
export function sceneActionForAccess(input: {
  scene: ForestScene;
  status: AccessStatus;
  hasWallet: boolean;
}): AccessSceneAction {
  if (input.scene === 'intro' || input.scene === 'gateDwell') return 'none';

  if (input.status === 'insufficient') {
    return input.scene === 'gate' || input.scene === 'denied' ? 'denied' : 'none';
  }

  if (input.scene === 'denied') return 'gate';

  if (input.status !== 'granted' || !input.hasWallet) {
    if (
      input.scene === 'forest' ||
      input.scene === 'forestDwell' ||
      input.scene === 'forestEntry' ||
      input.scene === 'granted'
    ) {
      return 'gate';
    }
    return 'none';
  }

  if (input.scene === 'gate') return 'granted';
  return 'none';
}
