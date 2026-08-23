import { describe, expect, it } from 'vitest';
import {
  CINEMATIC_TIMING,
  FOREST_ENTRY_FADE_MS,
  FOREST_ENTRY_WATCHDOG_MS,
  HOLDER_RANKING_VISIBLE_TOP,
  REDUCED_MOTION_TIMING,
  gateWalletUiDelayMs,
  getCinematicTiming,
} from './timing';

describe('cinematic timing', () => {
  it('keeps Gate II on screen for about 10 seconds before the wallet UI', () => {
    expect(CINEMATIC_TIMING.gateDwellMs).toBe(10_000);
    expect(gateWalletUiDelayMs(CINEMATIC_TIMING)).toBe(CINEMATIC_TIMING.gateDwellMs);
    expect(CINEMATIC_TIMING.walletUiFadeMs).toBeGreaterThanOrEqual(800);
    expect(CINEMATIC_TIMING.walletUiFadeMs).toBeLessThanOrEqual(1200);
  });

  it('holds ACCESS GRANTED, then allows the Forest entry cinematic', () => {
    expect(CINEMATIC_TIMING.accessGrantedMs).toBeGreaterThanOrEqual(1800);
    expect(CINEMATIC_TIMING.accessGrantedMs).toBeLessThanOrEqual(2500);
    expect(FOREST_ENTRY_WATCHDOG_MS).toBeGreaterThanOrEqual(2500);
    expect(FOREST_ENTRY_WATCHDOG_MS).toBeLessThan(10_000);
    expect(FOREST_ENTRY_FADE_MS).toBeGreaterThanOrEqual(800);
    expect(FOREST_ENTRY_FADE_MS).toBeLessThanOrEqual(1600);
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

  it('keeps the holder leaderboard at Top 20', () => {
    expect(HOLDER_RANKING_VISIBLE_TOP).toBe(20);
  });
});
