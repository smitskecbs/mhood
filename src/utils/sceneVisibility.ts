import type { ForestScene } from '../types';

export type SceneVisualState = {
  blackout: boolean;
  showGateUi: boolean;
  showGranted: boolean;
  showForestUi: boolean;
  introActive: boolean;
  gateIIVisible: boolean;
  walletUiVisible: boolean;
  walletUiInteractive: boolean;
  forestBackground: boolean;
};

export function sceneVisualState(scene: ForestScene): SceneVisualState {
  const granted = scene === 'granted';
  const forest = scene === 'forestDwell' || scene === 'forest';
  return {
    blackout: granted,
    showGateUi: scene === 'gate',
    showGranted: granted,
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
