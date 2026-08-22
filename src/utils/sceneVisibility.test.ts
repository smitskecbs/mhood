import { describe, expect, it } from 'vitest';
import { grantedSceneIsBlack, sceneVisualState } from './sceneVisibility';

describe('ACCESS GRANTED scene', () => {
  it('is a fully black scene with no gate or forest backgrounds', () => {
    const visuals = sceneVisualState('granted');
    expect(visuals.blackout).toBe(true);
    expect(visuals.showGranted).toBe(true);
    expect(visuals.showGateUi).toBe(false);
    expect(visuals.showForestUi).toBe(false);
    expect(visuals.forestBackground).toBe(false);
    expect(visuals.walletUiVisible).toBe(false);
    expect(visuals.gateIIVisible).toBe(false);
    expect(grantedSceneIsBlack(visuals)).toBe(true);
  });

  it('reveals the Forest after the granted hold', () => {
    expect(sceneVisualState('forestDwell').forestBackground).toBe(true);
    expect(sceneVisualState('forestDwell').blackout).toBe(false);
    expect(sceneVisualState('forestDwell').showGranted).toBe(false);
    expect(sceneVisualState('forest').showForestUi).toBe(true);
  });

  it('keeps the wallet UI hidden during the Gate II cinematic dwell', () => {
    expect(sceneVisualState('gateDwell').walletUiVisible).toBe(false);
    expect(sceneVisualState('gateDwell').walletUiInteractive).toBe(false);
    expect(sceneVisualState('gateDwell').gateIIVisible).toBe(true);
    expect(sceneVisualState('gate').walletUiVisible).toBe(true);
    expect(sceneVisualState('gate').walletUiInteractive).toBe(true);
    expect(sceneVisualState('gate').walletUiInteractive).toBe(sceneVisualState('gate').walletUiVisible);
  });
});
