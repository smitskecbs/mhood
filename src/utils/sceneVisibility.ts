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
  const forest = scene === 'forestDwell' || scene === 'forest';
  return {
    blackout: granted,
    showGateUi: scene === 'gate',
    showGranted: granted,
    showDenied: denied,
    denied,
    showForestUi: scene === 'forest',
    introActive: scene === 'intro',
    gateIIVisible: scene === 'gateDwell' || scene === 'gate',
    walletUiVisible: scene === 'gate',
    walletUiInteractive: scene === 'gate',
    forestBackground: forest,
  };
}

export function grantedSceneIsBlack(visuals: SceneVisualState): boolean {
  return visuals.blackout && visuals.showGranted && !visuals.forestBackground && !visuals.showGateUi;
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
    if (input.scene === 'forest' || input.scene === 'forestDwell' || input.scene === 'granted') {
      return 'gate';
    }
    return 'none';
  }

  if (input.scene === 'gate') return 'granted';
  return 'none';
}
