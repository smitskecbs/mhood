export type GateIICinematicPhase =
  | 'idle'
  | 'ambient'
  | 'awakening'
  | 'activation'
  | 'climax'
  | 'dim'
  | 'rest';

export type GateIIPhaseStep = {
  phase: Exclude<GateIICinematicPhase, 'idle' | 'rest'>;
  atMs: number;
};

/** Intensities inside the existing ~10s Gate II dwell. */
export const GATE_II_PHASE_SCHEDULE: readonly GateIIPhaseStep[] = [
  { phase: 'ambient', atMs: 0 },
  { phase: 'awakening', atMs: 2_000 },
  { phase: 'activation', atMs: 5_000 },
  { phase: 'climax', atMs: 7_000 },
  { phase: 'dim', atMs: 9_200 },
] as const;

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
  kind: 'dust' | 'ember' | 'spark';
};

export type GateIIMeteorConfig = {
  id: string;
  top: string;
  left: string;
  angle: number;
  duration: number;
  delay: number;
  length: number;
  opacity: number;
  band: 'early' | 'mid' | 'late';
};

export const GATE_II_PARTICLES: readonly GateIIParticleConfig[] = [
  { id: 'p1', top: '14%', left: '12%', size: 2, duration: 16, delay: 0.1, dx: '12px', dy: '-28px', opacity: 0.34, kind: 'dust' },
  { id: 'p2', top: '22%', left: '78%', size: 2, duration: 19, delay: 0.6, dx: '-10px', dy: '-22px', opacity: 0.28, kind: 'dust' },
  { id: 'p3', top: '38%', left: '18%', size: 3, duration: 14, delay: 0.2, dx: '8px', dy: '-36px', opacity: 0.4, kind: 'ember' },
  { id: 'p4', top: '46%', left: '86%', size: 2, duration: 18, delay: 1.1, dx: '-14px', dy: '-18px', opacity: 0.3, kind: 'dust' },
  { id: 'p5', top: '58%', left: '8%', size: 2, duration: 21, delay: 0.4, dx: '16px', dy: '-24px', opacity: 0.26, kind: 'dust' },
  { id: 'p6', top: '64%', left: '72%', size: 3, duration: 15, delay: 0.8, dx: '-8px', dy: '-32px', opacity: 0.38, kind: 'ember' },
  { id: 'p7', top: '18%', left: '48%', size: 2, duration: 17, delay: 0.3, dx: '6px', dy: '-20px', opacity: 0.32, kind: 'spark' },
  { id: 'p8', top: '32%', left: '62%', size: 2, duration: 20, delay: 1.4, dx: '-12px', dy: '-26px', opacity: 0.24, kind: 'dust' },
  { id: 'p9', top: '70%', left: '40%', size: 2, duration: 22, delay: 0.5, dx: '10px', dy: '-16px', opacity: 0.22, kind: 'dust' },
  { id: 'p10', top: '28%', left: '34%', size: 3, duration: 13, delay: 0.9, dx: '-6px', dy: '-30px', opacity: 0.36, kind: 'ember' },
  { id: 'p11', top: '52%', left: '54%', size: 2, duration: 18, delay: 1.7, dx: '14px', dy: '-22px', opacity: 0.3, kind: 'spark' },
  { id: 'p12', top: '76%', left: '22%', size: 2, duration: 19, delay: 0.7, dx: '8px', dy: '-18px', opacity: 0.2, kind: 'dust' },
];

/** Staggered so at most ~2–3 streaks overlap. Delays are from Gate II living start. */
export const GATE_II_METEORS: readonly GateIIMeteorConfig[] = [
  { id: 'm1', top: '10%', left: '68%', angle: -32, duration: 1.15, delay: 2.35, length: 88, opacity: 0.42, band: 'early' },
  { id: 'm2', top: '16%', left: '44%', angle: -26, duration: 1.55, delay: 3.7, length: 120, opacity: 0.38, band: 'early' },
  { id: 'm3', top: '8%', left: '82%', angle: -38, duration: 1.05, delay: 5.25, length: 96, opacity: 0.55, band: 'mid' },
  { id: 'm4', top: '22%', left: '30%', angle: -22, duration: 1.7, delay: 6.15, length: 140, opacity: 0.48, band: 'mid' },
  { id: 'm5', top: '6%', left: '58%', angle: -34, duration: 1.2, delay: 7.15, length: 110, opacity: 0.62, band: 'late' },
  { id: 'm6', top: '18%', left: '76%', angle: -28, duration: 0.95, delay: 7.85, length: 78, opacity: 0.58, band: 'late' },
  { id: 'm7', top: '12%', left: '38%', angle: -36, duration: 1.45, delay: 8.45, length: 132, opacity: 0.52, band: 'late' },
  { id: 'm8', top: '4%', left: '90%', angle: -40, duration: 1.1, delay: 8.95, length: 100, opacity: 0.46, band: 'late' },
];

export function resolveGateIIPhase(elapsedMs: number): GateIICinematicPhase {
  let current: GateIICinematicPhase = 'ambient';
  for (const step of GATE_II_PHASE_SCHEDULE) {
    if (elapsedMs >= step.atMs) current = step.phase;
  }
  return current;
}

export function gateIIBusyEffectsAllowed(phase: GateIICinematicPhase): boolean {
  return phase === 'awakening' || phase === 'activation' || phase === 'climax';
}

export function overlappingMeteorsAt(elapsedMs: number, meteors = GATE_II_METEORS): number {
  return meteors.filter((meteor) => {
    const start = meteor.delay * 1000;
    const end = start + meteor.duration * 1000;
    return elapsedMs >= start && elapsedMs <= end;
  }).length;
}
