import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, FOREST_ENTRY_VIDEO } from '../config/constants';
import type { ForestEntryFinishReason, ForestEntryReplayTrigger } from './forestEntry';
import {
  canShowForestEntry,
  forestEntryFinishDelayMs,
  forestEntryPlaybackAttrs,
  nextSceneAfterGranted,
  sceneAfterForestEntry,
  shouldReplayForestEntry,
  shouldStartForestEntryFade,
} from './forestEntry';

describe('forest entry cinematic', () => {
  it('uses the forest-entry.mp4 asset with background3 as poster', () => {
    const playback = forestEntryPlaybackAttrs();
    expect(playback.src).toBe(FOREST_ENTRY_VIDEO);
    expect(playback.src).toBe('/backgrounds/forest-entry.mp4');
    expect(playback.poster).toBe(BACKGROUNDS.forest);
    expect(playback.autoPlay).toBe(true);
    expect(playback.muted).toBe(true);
    expect(playback.playsInline).toBe(true);
    expect(playback.controls).toBe(false);
    expect(playback.loop).toBe(false);
    expect(playback.preload).toBe('auto');
  });

  it('plays only after a successful holder access grant', () => {
    expect(canShowForestEntry({ scene: 'forestEntry', status: 'granted' })).toBe(true);
    expect(nextSceneAfterGranted(false)).toBe('forestEntry');
    expect(canShowForestEntry({ scene: 'granted', status: 'granted' })).toBe(false);
    expect(canShowForestEntry({ scene: 'gate', status: 'granted' })).toBe(false);
    expect(canShowForestEntry({ scene: 'forest', status: 'granted' })).toBe(false);
  });

  it('does not play for a denied or unverified wallet', () => {
    expect(canShowForestEntry({ scene: 'denied', status: 'insufficient' })).toBe(false);
    expect(canShowForestEntry({ scene: 'forestEntry', status: 'insufficient' })).toBe(false);
    expect(canShowForestEntry({ scene: 'forestEntry', status: 'disconnected' })).toBe(false);
    expect(canShowForestEntry({ scene: 'gate', status: 'checking' })).toBe(false);
  });

  it('skips the video when reduced motion is preferred', () => {
    expect(nextSceneAfterGranted(true)).toBe('forestDwell');
    expect(canShowForestEntry({ scene: 'forestEntry', status: 'granted', reducedMotion: true })).toBe(false);
  });

  it('does not replay after burn return, dashboard refresh, or rerender', () => {
    const blocked: ForestEntryReplayTrigger[] = [
      'burn-return',
      'dashboard-refresh',
      'holder-refresh',
      'rerender',
    ];
    for (const trigger of blocked) {
      expect(shouldReplayForestEntry(trigger)).toBe(false);
    }
    expect(shouldReplayForestEntry('access-granted')).toBe(true);
  });

  it('crossfades near the end and lands on the authenticated Forest', () => {
    expect(shouldStartForestEntryFade(9.2, 10, 1100)).toBe(true);
    expect(shouldStartForestEntryFade(0.1, 10, 1100)).toBe(false);
    expect(shouldStartForestEntryFade(0, 0, 1100)).toBe(false);
    expect(sceneAfterForestEntry()).toBe('forest');
  });

  it('falls back to Forest immediately on error, play rejection, or watchdog', () => {
    const failures: ForestEntryFinishReason[] = ['error', 'play-rejected', 'watchdog'];
    for (const reason of failures) {
      expect(forestEntryFinishDelayMs(reason)).toBe(0);
      expect(sceneAfterForestEntry()).toBe('forest');
    }
    expect(forestEntryFinishDelayMs('ended')).toBeGreaterThan(0);
  });
});
