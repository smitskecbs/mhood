export type CinematicTiming = {
  introHoldMs: number;
  gateCrossfadeMs: number;
  gateDwellMs: number;
  walletUiFadeMs: number;
  accessGrantedMs: number;
  forestCrossfadeMs: number;
  forestDwellMs: number;
  forestStageStaggerMs: number;
};

export const CINEMATIC_TIMING: CinematicTiming = {
  introHoldMs: 2400,
  gateCrossfadeMs: 2800,
  /** Gate II cinematic sequence before the wallet UI, including the Gate I crossfade. */
  gateDwellMs: 10_000,
  walletUiFadeMs: 1200,
  accessGrantedMs: 2200,
  forestCrossfadeMs: 2200,
  forestDwellMs: 4500,
  forestStageStaggerMs: 650,
};

export const REDUCED_MOTION_TIMING: CinematicTiming = {
  introHoldMs: 400,
  gateCrossfadeMs: 450,
  gateDwellMs: 500,
  walletUiFadeMs: 280,
  accessGrantedMs: 400,
  forestCrossfadeMs: 450,
  forestDwellMs: 400,
  forestStageStaggerMs: 0,
};

export function getCinematicTiming(reducedMotion: boolean): CinematicTiming {
  return reducedMotion ? REDUCED_MOTION_TIMING : CINEMATIC_TIMING;
}

export function gateWalletUiDelayMs(timing: CinematicTiming): number {
  return timing.gateDwellMs;
}

export const FOREST_UI_STAGES = ['identity', 'stats', 'holders', 'tokenomics', 'burns'] as const;
export type ForestUiStage = (typeof FOREST_UI_STAGES)[number];

export const HOLDER_RANKING_CACHE_MS = 5 * 60 * 1000;
export const HOLDER_RANKING_PAGE_SIZE = 1000;
export const HOLDER_RANKING_MAX_PAGES = 80;
export const HOLDER_RANKING_VISIBLE_TOP = 20;
