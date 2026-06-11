import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { WaveformVisualizer } from './WaveformVisualizer';
import type { ClipDuration, ClipUrlMap } from '../../types/track';

export type ClipPlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface ClipPlayerProps {
  clipUrls: ClipUrlMap;
  currentDuration: ClipDuration;
  /** Starts the speed clock. */
  onPlaybackStart: () => void;
  /** Signals the clip finished playing (auto-loop or "extend available"). */
  onPlaybackEnd: () => void;
  /** Reserved for a future tap-to-extend gesture; `<ClipExtendBar>` drives extensions for now. */
  onExtendRequest: () => void;
}

/**
 * Wraps `AudioEngine` and renders the waveform plus an iOS-friendly
 * "Tap to Start" unlock overlay (Web Audio contexts must be resumed
 * from a user gesture before the first `play()` call).
 */
export function ClipPlayer({ clipUrls, currentDuration, onPlaybackStart, onPlaybackEnd }: ClipPlayerProps): React.ReactElement {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<ClipPlayerStatus>('loading');
  const [unlocked, setUnlocked] = useState(false);
  const previousDuration = useRef(currentDuration);

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
      });
    return (): void => {
      cancelled = true;
    };
  }, [clipUrls, getEngine]);

  const playClip = useCallback(
    async (duration: ClipDuration): Promise<void> => {
      const engine = getEngine();
      setStatus('playing');
      onPlaybackStart();
      await engine.play(duration);
      setStatus('ended');
      onPlaybackEnd();
    },
    [getEngine, onPlaybackStart, onPlaybackEnd],
  );

  const handleTapToStart = useCallback(async (): Promise<void> => {
    if (status === 'loading') return;
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
      <WaveformVisualizer getData={(): Uint8Array => getEngine().getWaveformData()} isActive={status === 'playing'} />
      {!unlocked && (
        <button
          type="button"
          onClick={(): void => void handleTapToStart()}
          disabled={status === 'loading'}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-lg font-semibold text-white disabled:cursor-wait"
          data-testid="tap-to-start"
        >
          {status === 'loading' ? 'Loading…' : 'Tap to Start'}
        </button>
      )}
    </div>
  );
}
