import { describe, expect, it } from 'vitest';
import {
  CINEMATIC_TIMING,
  REDUCED_MOTION_TIMING,
  gateWalletUiDelayMs,
  getCinematicTiming,
} from './timing';

describe('cinematic timing', () => {
  it('keeps Gate II on screen for about 10 seconds before the wallet UI', () => {
    expect(CINEMATIC_TIMING.gateDwellMs).toBe(10_000);
    expect(gateWalletUiDelayMs(CINEMATIC_TIMING)).toBe(CINEMATIC_TIMING.gateDwellMs);
    expect(CINEMATIC_TIMING.walletUiFadeMs).toBeGreaterThanOrEqual(1000);
    expect(CINEMATIC_TIMING.walletUiFadeMs).toBeLessThanOrEqual(1500);
  });

  it('shows the Forest without dashboard for several seconds', () => {
    expect(CINEMATIC_TIMING.accessGrantedMs).toBeGreaterThanOrEqual(1800);
    expect(CINEMATIC_TIMING.accessGrantedMs).toBeLessThanOrEqual(2500);
    expect(CINEMATIC_TIMING.forestDwellMs).toBeGreaterThanOrEqual(4000);
    expect(CINEMATIC_TIMING.forestDwellMs).toBeLessThanOrEqual(5000);
    expect(CINEMATIC_TIMING.forestStageStaggerMs).toBeGreaterThan(0);
  });

  it('shortens waits when reduced motion is preferred', () => {
    const reduced = getCinematicTiming(true);
    expect(reduced).toEqual(REDUCED_MOTION_TIMING);
    expect(reduced.gateDwellMs).toBeLessThan(CINEMATIC_TIMING.gateDwellMs);
    expect(reduced.forestDwellMs).toBeLessThan(CINEMATIC_TIMING.forestDwellMs);
    expect(reduced.forestStageStaggerMs).toBe(0);
    expect(gateWalletUiDelayMs(reduced)).toBeLessThan(2000);
  });
});
