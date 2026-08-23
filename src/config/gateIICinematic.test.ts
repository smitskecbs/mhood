import { describe, expect, it } from 'vitest';
import {
  GATE_II_PARTICLES,
  GATE_II_PHASE_SCHEDULE,
  GATE_II_AMBIENT_MS,
  GATE_II_DISTURBANCE_MS,
  GATE_II_FADE_MS,
  resolveGateIIPhase,
} from './gateIICinematic';

describe('Gate II cinematic schedule', () => {
  it('keeps a quiet reading phase for the first 5 seconds', () => {
    expect(resolveGateIIPhase(0)).toBe('ambient');
    expect(resolveGateIIPhase(4_999)).toBe('ambient');
    expect(GATE_II_AMBIENT_MS).toBe(5_000);
    expect(GATE_II_PHASE_SCHEDULE.map((step) => step.phase)).toEqual([
      'ambient',
      'disturbance',
      'fade',
    ]);
  });

  it('builds noise and darken from 5s, then fades to black from 8s', () => {
    expect(resolveGateIIPhase(5_000)).toBe('disturbance');
    expect(resolveGateIIPhase(7_999)).toBe('disturbance');
    expect(resolveGateIIPhase(8_000)).toBe('fade');
    expect(resolveGateIIPhase(9_999)).toBe('fade');
    expect(GATE_II_DISTURBANCE_MS).toBe(8_000);
    expect(GATE_II_FADE_MS).toBe(10_000);
  });

  it('does not ship meteors or busy climax helpers', () => {
    expect('GATE_II_METEORS' in globalThis).toBe(false);
    expect(GATE_II_PARTICLES).toHaveLength(6);
    expect(GATE_II_PARTICLES.every((particle) => particle.kind === 'dust')).toBe(true);
    expect(GATE_II_PARTICLES.every((particle) => particle.size <= 2)).toBe(true);
    expect(GATE_II_PARTICLES.every((particle) => particle.opacity <= 0.18)).toBe(true);
  });

  it('uses a stable particle set without random layout', () => {
    expect(new Set(GATE_II_PARTICLES.map((particle) => particle.id)).size).toBe(6);
  });
});
