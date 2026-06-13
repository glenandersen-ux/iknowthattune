import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { MultiplierBackground } from './MultiplierBackground';
import { MAX_SPEED_MULTIPLIER } from '../../engine/ScoringEngine';
import type { ClipDuration, ClipUrlMap } from '../../types/track';

export type ClipPlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface ClipPlayerProps {
  clipUrls: ClipUrlMap;
  currentDuration: ClipDuration;
  /** Offset, in milliseconds, into the clip where playback should start (e.g. a track's "hook"). */
  clipStartOffsetMs?: number;
  /**
   * Live speed multiplier (DeepDive §A.4), recomputed every animation frame
   * by the caller. Drives the shrinking bonus meter shown while playing.
   */
  multiplier?: number;
  /** Starts the speed clock. */
  onPlaybackStart: () => void;
  /** Signals the clip finished playing (auto-loop or "extend available"). */
  onPlaybackEnd: () => void;
  /** Reserved for a future tap-to-extend gesture; `<ClipExtendBar>` drives extensions for now. */
  onExtendRequest: () => void;
}

/**
 * Wraps `AudioEngine` and renders the shrinking-multiplier background plus
 * an iOS-friendly "Start" unlock button (Web Audio contexts must be resumed
 * from a user gesture before the first `play()` call).
 */
export function ClipPlayer({
  clipUrls,
  currentDuration,
  clipStartOffsetMs = 0,
  multiplier = MAX_SPEED_MULTIPLIER,
  onPlaybackStart,
  onPlaybackEnd,
}: ClipPlayerProps): React.ReactElement {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<ClipPlayerStatus>('loading');
  const [unlocked, setUnlocked] = useState(false);
  const previousDuration = useRef(currentDuration);
  // Guards against `playClip`'s pending `engine.play()` promise also firing
  // `onPlaybackEnd` once `handleStop` has already transitioned the player.
  const stoppedRef = useRef(false);

  const getEngine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setStatus('loading');
      })
      .then(() => getEngine().preloadTrack(clipUrls))
      .then(() => {
        if (!cancelled) setStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        // No clip durations loaded (e.g. an expired preview URL). Surface an
        // error state and advance the game phase so the player isn't stuck
        // on "Loading..." forever — they can still guess or give up.
        setStatus('error');
        setUnlocked(true);
        onPlaybackStart();
        onPlaybackEnd();
      });
    return (): void => {
      cancelled = true;
    };
  }, [clipUrls, getEngine]);

  const playClip = useCallback(
    async (duration: ClipDuration): Promise<void> => {
      const engine = getEngine();
      stoppedRef.current = false;
      setStatus('playing');
      onPlaybackStart();
      try {
        await engine.play(duration, clipStartOffsetMs / 1000);
      } catch {
        if (!stoppedRef.current) setStatus('error');
        return;
      }
      if (stoppedRef.current) return;
      setStatus('ended');
      onPlaybackEnd();
    },
    [getEngine, onPlaybackStart, onPlaybackEnd, clipStartOffsetMs],
  );

  const handleStop = useCallback((): void => {
    if (status !== 'playing') return;
    stoppedRef.current = true;
    getEngine().stop();
    setStatus('ended');
    onPlaybackEnd();
  }, [status, getEngine, onPlaybackEnd]);

  const handleTapToStart = useCallback(async (): Promise<void> => {
    if (status === 'loading' || status === 'error') return;
    const engine = getEngine();
    await engine.unlock();
    setUnlocked(true);
    await playClip(currentDuration);
  }, [status, getEngine, playClip, currentDuration]);

  useEffect(() => {
    if (unlocked && previousDuration.current !== currentDuration) {
      previousDuration.current = currentDuration;
      void playClip(currentDuration);
    }
  }, [currentDuration, unlocked, playClip]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-900 p-4" data-testid="clip-player">
      <MultiplierBackground multiplier={multiplier} isActive={status === 'playing'} />
      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 px-4 text-center text-sm font-semibold text-amber-300"
          data-testid="clip-error"
        >
          ⚠️ Audio unavailable for this track — guess or give up to continue.
        </div>
      )}
      {!unlocked && status !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
          <button
            type="button"
            onClick={(): void => void handleTapToStart()}
            disabled={status === 'loading'}
            className="rounded-full bg-white px-8 py-2 text-lg font-semibold text-slate-900 shadow-lg disabled:cursor-wait disabled:opacity-50"
            data-testid="tap-to-start"
          >
            {status === 'loading' ? 'Loading…' : 'Start'}
          </button>
        </div>
      )}
      {status === 'playing' && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <button
            type="button"
            onClick={handleStop}
            className="rounded-full bg-white px-6 py-1.5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100"
            data-testid="stop-button"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
