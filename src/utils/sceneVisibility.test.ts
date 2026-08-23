import { describe, expect, it } from 'vitest';
import {
  deniedSceneUsesBackground1,
  grantedSceneIsBlack,
  sceneActionForAccess,
  sceneVisualState,
  walletSceneIsBlack,
} from './sceneVisibility';

describe('ACCESS GRANTED scene', () => {
  it('is a fully black scene with no gate or forest backgrounds', () => {
    const visuals = sceneVisualState('granted');
    expect(visuals.blackout).toBe(true);
    expect(visuals.showGranted).toBe(true);
    expect(visuals.showDenied).toBe(false);
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
    expect(sceneVisualState('gateDwell').blackout).toBe(false);
    expect(sceneVisualState('gate').walletUiVisible).toBe(true);
    expect(sceneVisualState('gate').walletUiInteractive).toBe(true);
    expect(sceneVisualState('gate').walletUiInteractive).toBe(sceneVisualState('gate').walletUiVisible);
  });

  it('shows the wallet card only after Gate II has gone fully black', () => {
    const visuals = sceneVisualState('gate');
    expect(walletSceneIsBlack(visuals)).toBe(true);
    expect(visuals.blackout).toBe(true);
    expect(visuals.gateIIVisible).toBe(false);
    expect(visuals.showGateUi).toBe(true);
    expect(visuals.forestBackground).toBe(false);
  });
});

describe('access denied scene', () => {
  it('returns to background1 without the black ACCESS GRANTED overlay', () => {
    const visuals = sceneVisualState('denied');
    expect(visuals.denied).toBe(true);
    expect(visuals.showDenied).toBe(true);
    expect(visuals.blackout).toBe(false);
    expect(visuals.showGranted).toBe(false);
    expect(visuals.showGateUi).toBe(false);
    expect(visuals.walletUiVisible).toBe(false);
    expect(visuals.gateIIVisible).toBe(false);
    expect(visuals.forestBackground).toBe(false);
    expect(deniedSceneUsesBackground1(visuals)).toBe(true);
    expect(grantedSceneIsBlack(visuals)).toBe(false);
    expect(walletSceneIsBlack(visuals)).toBe(false);
  });
});

describe('sceneActionForAccess', () => {
  it('opens the denied scene for an authenticated wallet below the threshold', () => {
    expect(sceneActionForAccess({ scene: 'gate', status: 'insufficient', hasWallet: true })).toBe('denied');
    expect(sceneActionForAccess({ scene: 'denied', status: 'insufficient', hasWallet: true })).toBe('denied');
  });

  it('returns to the wallet picker after Try another wallet disconnects', () => {
    expect(sceneActionForAccess({ scene: 'denied', status: 'disconnected', hasWallet: false })).toBe('gate');
  });

  it('keeps the existing black ACCESS GRANTED flow for a sufficient holder', () => {
    expect(sceneActionForAccess({ scene: 'gate', status: 'granted', hasWallet: true })).toBe('granted');
    expect(sceneActionForAccess({ scene: 'granted', status: 'granted', hasWallet: true })).toBe('none');
    expect(sceneActionForAccess({ scene: 'gateDwell', status: 'granted', hasWallet: true })).toBe('none');
  });

  it('does not interrupt intro or Gate II cinematic timing', () => {
    expect(sceneActionForAccess({ scene: 'intro', status: 'insufficient', hasWallet: true })).toBe('none');
    expect(sceneActionForAccess({ scene: 'gateDwell', status: 'insufficient', hasWallet: true })).toBe('none');
  });
});
