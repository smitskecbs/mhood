import { BACKGROUNDS, FOREST_ENTRY_VIDEO } from '../config/constants';
import { FOREST_ENTRY_FADE_MS } from '../config/timing';
import type { AccessStatus, ForestScene } from '../types';

export type ForestEntryFinishReason = 'ended' | 'error' | 'play-rejected' | 'watchdog';
export type ForestEntryReplayTrigger =
  | 'access-granted'
  | 'burn-return'
  | 'dashboard-refresh'
  | 'holder-refresh'
  | 'rerender';

export function nextSceneAfterGranted(reducedMotion: boolean): Extract<ForestScene, 'forestEntry' | 'forestDwell'> {
  return reducedMotion ? 'forestDwell' : 'forestEntry';
}

export function canShowForestEntry(input: {
  scene: ForestScene;
  status: AccessStatus;
  reducedMotion?: boolean;
}): boolean {
  return input.scene === 'forestEntry' && input.status === 'granted' && input.reducedMotion !== true;
}

export function shouldReplayForestEntry(trigger: ForestEntryReplayTrigger): boolean {
  return trigger === 'access-granted';
}

export function forestEntryPlaybackAttrs() {
  return {
    autoPlay: true,
    muted: true,
    playsInline: true,
    controls: false,
    loop: false,
    preload: 'auto' as const,
    poster: BACKGROUNDS.forest,
    src: FOREST_ENTRY_VIDEO,
  };
}

export function shouldStartForestEntryFade(
  currentTime: number,
  duration: number,
  fadeMs = FOREST_ENTRY_FADE_MS,
): boolean {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return false;
  return currentTime >= Math.max(0, duration - fadeMs / 1000);
}

export function forestEntryFinishDelayMs(reason: ForestEntryFinishReason, fadeMs = FOREST_ENTRY_FADE_MS): number {
  return reason === 'ended' ? fadeMs : 0;
}

export function sceneAfterForestEntry(): Extract<ForestScene, 'forest'> {
  return 'forest';
}
