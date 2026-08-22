import { describe, expect, it } from 'vitest';
import {
  GATE_II_METEORS,
  GATE_II_PARTICLES,
  GATE_II_PHASE_SCHEDULE,
  gateIIBusyEffectsAllowed,
  overlappingMeteorsAt,
  resolveGateIIPhase,
} from './gateIICinematic';

describe('Gate II cinematic schedule', () => {
  it('starts ambient immediately and awakens around 2–5 seconds', () => {
    expect(resolveGateIIPhase(0)).toBe('ambient');
    expect(resolveGateIIPhase(1_999)).toBe('ambient');
    expect(resolveGateIIPhase(2_000)).toBe('awakening');
    expect(resolveGateIIPhase(4_999)).toBe('awakening');
    expect(GATE_II_PHASE_SCHEDULE.map((step) => step.phase)).toEqual([
      'ambient',
      'awakening',
      'activation',
      'climax',
      'dim',
    ]);
  });

  it('activates from 5s and climaxes through the last seconds before wallet', () => {
    expect(resolveGateIIPhase(5_000)).toBe('activation');
    expect(resolveGateIIPhase(6_999)).toBe('activation');
    expect(resolveGateIIPhase(7_000)).toBe('climax');
    expect(resolveGateIIPhase(9_199)).toBe('climax');
    expect(resolveGateIIPhase(9_200)).toBe('dim');
  });

  it('keeps meteor overlap at most about 2–3 streaks', () => {
    expect(GATE_II_METEORS).toHaveLength(8);
    let peak = 0;
    for (let ms = 0; ms <= 10_000; ms += 50) {
      peak = Math.max(peak, overlappingMeteorsAt(ms));
    }
    expect(peak).toBeGreaterThanOrEqual(1);
    expect(peak).toBeLessThanOrEqual(3);
    expect(gateIIBusyEffectsAllowed('ambient')).toBe(false);
    expect(gateIIBusyEffectsAllowed('climax')).toBe(true);
    expect(gateIIBusyEffectsAllowed('rest')).toBe(false);
  });

  it('uses a stable particle set without random layout', () => {
    expect(GATE_II_PARTICLES).toHaveLength(12);
    expect(new Set(GATE_II_PARTICLES.map((particle) => particle.id)).size).toBe(12);
    expect(GATE_II_PARTICLES.every((particle) => particle.size <= 3)).toBe(true);
  });
});
