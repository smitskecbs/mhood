import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUNDS, FOREST_ENTRY_VIDEO } from '../../config/constants';
import { FOREST_ENTRY_WATCHDOG_MS } from '../../config/timing';
import { ForestEntryScene } from './ForestEntryScene';

describe('ForestEntryScene', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    });
    const pause = () => undefined;
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, writable: true, value: pause });
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', { configurable: true, writable: true, value: pause });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders an inline muted video without controls or looping', () => {
    render(<ForestEntryScene onFinished={() => undefined} />);
    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(video).toHaveAttribute('src', FOREST_ENTRY_VIDEO);
    expect(video).toHaveAttribute('poster', BACKGROUNDS.forest);
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('webkit-playsinline');
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(false);
    expect(video?.controls).toBe(false);
    expect(video).toHaveAttribute('preload', 'auto');
  });

  it('finishes to Forest when the video ends', () => {
    const onFinished = vi.fn();
    vi.useFakeTimers();
    render(<ForestEntryScene onFinished={onFinished} />);
    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    fireEvent.ended(video!);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(onFinished).toHaveBeenCalledWith('ended');
  });

  it('falls back to Forest on a media error', () => {
    const onFinished = vi.fn();
    render(<ForestEntryScene onFinished={onFinished} />);
    fireEvent.error(document.querySelector('video')!);
    expect(onFinished).toHaveBeenCalledWith('error');
    expect(screen.queryByTestId('forest-entry')).toBeInTheDocument();
  });

  it('falls back to Forest when autoplay is rejected', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    const onFinished = vi.fn();
    render(<ForestEntryScene onFinished={onFinished} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onFinished).toHaveBeenCalledWith('play-rejected');
  });

  it('falls back to Forest when playback never starts', () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => Promise.resolve());
    const paused = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused');
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get: () => true });
    const onFinished = vi.fn();
    vi.useFakeTimers();
    render(<ForestEntryScene onFinished={onFinished} />);
    act(() => {
      vi.advanceTimersByTime(FOREST_ENTRY_WATCHDOG_MS);
    });
    expect(onFinished).toHaveBeenCalledWith('watchdog');
    if (paused) {
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', paused);
    } else {
      Reflect.deleteProperty(HTMLMediaElement.prototype, 'paused');
    }
  });

  it('unmounts the video after the entry scene closes', () => {
    const { unmount } = render(<ForestEntryScene onFinished={() => undefined} />);
    expect(document.querySelector('video')).toBeTruthy();
    unmount();
    expect(document.querySelector('[data-testid="forest-entry"]')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });
});

