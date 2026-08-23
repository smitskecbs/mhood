export type GateIICinematicPhase = 'idle' | 'ambient' | 'disturbance' | 'fade';

export type GateIIPhaseStep = {
  phase: Exclude<GateIICinematicPhase, 'idle'>;
  atMs: number;
};

/**
 * Gate II dwell (~10s): quiet reading, then noise/darken, then fade to black.
 * Wallet UI appears only after this sequence, on a black screen.
 */
export const GATE_II_PHASE_SCHEDULE: readonly GateIIPhaseStep[] = [
  { phase: 'ambient', atMs: 0 },
  { phase: 'disturbance', atMs: 5_000 },
  { phase: 'fade', atMs: 8_000 },
] as const;

export const GATE_II_AMBIENT_MS = 5_000;
export const GATE_II_DISTURBANCE_MS = 8_000;
export const GATE_II_FADE_MS = 10_000;

export type GateIIParticleConfig = {
  id: string;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  dx: string;
  dy: string;
  opacity: number;
  kind: 'dust';
};

/** Sparse dust only — never meteors, sparks, or climax bursts. */
export const GATE_II_PARTICLES: readonly GateIIParticleConfig[] = [
  { id: 'p1', top: '16%', left: '14%', size: 2, duration: 22, delay: 0.2, dx: '8px', dy: '-18px', opacity: 0.16, kind: 'dust' },
  { id: 'p2', top: '28%', left: '78%', size: 2, duration: 26, delay: 0.8, dx: '-6px', dy: '-14px', opacity: 0.12, kind: 'dust' },
  { id: 'p3', top: '48%', left: '22%', size: 2, duration: 24, delay: 0.4, dx: '5px', dy: '-16px', opacity: 0.14, kind: 'dust' },
  { id: 'p4', top: '62%', left: '68%', size: 2, duration: 28, delay: 1.2, dx: '-8px', dy: '-12px', opacity: 0.1, kind: 'dust' },
  { id: 'p5', top: '38%', left: '52%', size: 2, duration: 25, delay: 0.6, dx: '4px', dy: '-10px', opacity: 0.13, kind: 'dust' },
  { id: 'p6', top: '74%', left: '36%', size: 2, duration: 27, delay: 1.0, dx: '6px', dy: '-8px', opacity: 0.11, kind: 'dust' },
];

export function resolveGateIIPhase(elapsedMs: number): GateIICinematicPhase {
  let current: GateIICinematicPhase = 'ambient';
  for (const step of GATE_II_PHASE_SCHEDULE) {
    if (elapsedMs >= step.atMs) current = step.phase;
  }
  return current;
}
