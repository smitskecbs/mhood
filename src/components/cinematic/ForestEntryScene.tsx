import { useCallback, useEffect, useRef, useState } from 'react';
import { FOREST_ENTRY_FADE_MS, FOREST_ENTRY_WATCHDOG_MS } from '../../config/timing';
import {
  forestEntryPlaybackAttrs,
  shouldStartForestEntryFade,
  type ForestEntryFinishReason,
} from '../../utils/forestEntry';

type ForestEntrySceneProps = {
  onPlaying?: () => void;
  onFinished: (reason: ForestEntryFinishReason) => void;
};

function pauseVideo(video: HTMLVideoElement | null) {
  try {
    video?.pause();
  } catch {
    /* jsdom and some in-app browsers throw if pause is unimplemented */
  }
}

export function ForestEntryScene({ onPlaying, onFinished }: ForestEntrySceneProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);
  const leavingRef = useRef(false);
  const leaveTimerRef = useRef<number | null>(null);
  const onFinishedRef = useRef(onFinished);
  const onPlayingRef = useRef(onPlaying);
  const [leaving, setLeaving] = useState(false);
  const playback = forestEntryPlaybackAttrs();

  onFinishedRef.current = onFinished;
  onPlayingRef.current = onPlaying;

  const finish = useCallback((reason: ForestEntryFinishReason) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      pauseVideo(video);
    }
    onFinishedRef.current(reason);
  }, []);

  const beginLeave = useCallback((reason: ForestEntryFinishReason) => {
    if (finishedRef.current) return;
    if (reason !== 'ended') {
      finish(reason);
      return;
    }
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    leaveTimerRef.current = window.setTimeout(() => finish('ended'), FOREST_ENTRY_FADE_MS);
  }, [finish]);

  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;
    node.muted = true;
    node.defaultMuted = true;
    node.playsInline = true;
    node.setAttribute('playsinline', 'true');
    node.setAttribute('webkit-playsinline', 'true');
    node.controls = false;
    node.loop = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) {
      finish('error');
      return;
    }

    try {
      video.currentTime = 0;
    } catch {
      /* some browsers reject seeking before metadata */
    }

    const attempt = video.play();
    if (attempt !== undefined) {
      void attempt.catch(() => {
        if (cancelled || finishedRef.current) return;
        finish('play-rejected');
      });
    }

    const watchdog = window.setTimeout(() => {
      if (cancelled || finishedRef.current || !video.paused) return;
      finish('watchdog');
    }, FOREST_ENTRY_WATCHDOG_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      if (leaveTimerRef.current) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      pauseVideo(video);
    };
  }, [finish]);

  function handlePlaying() {
    onPlayingRef.current?.();
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (shouldStartForestEntryFade(video.currentTime, video.duration, FOREST_ENTRY_FADE_MS)) {
      beginLeave('ended');
    }
  }

  return (
    <div
      className={`forest-entry${leaving ? ' is-leaving' : ''}`}
      data-testid="forest-entry"
      aria-hidden="true"
    >
      <div className="forest-entry__fill" style={{ backgroundImage: `url(${playback.poster})` }} />
      <div className="forest-entry__fit">
        <video
          ref={bindVideo}
          className="forest-entry__video"
          src={playback.src}
          poster={playback.poster}
          autoPlay={playback.autoPlay}
          muted={playback.muted}
          playsInline={playback.playsInline}
          controls={playback.controls}
          loop={playback.loop}
          preload={playback.preload}
          disablePictureInPicture
          onPlaying={handlePlaying}
          onEnded={() => beginLeave('ended')}
          onError={() => finish('error')}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
    </div>
  );
}
