import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { MultiplierBackground } from './MultiplierBackground';
import { MAX_SPEED_MULTIPLIER } from '../../engine/ScoringEngine';
import { fetchDeezerPreview, type DeezerPreview } from '../../engine/DeezerPreview';
import { fetchItunesPreview, type ItunesPreview } from '../../engine/ItunesPreview';
import { DeezerBadge } from './DeezerBadge';
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
  /** Reserved for a future tap-to-extend gesture. */
  onExtendRequest: () => void;
  /**
   * Song title / primary artist used to look up Deezer (primary) and iTunes
   * (secondary) previews when the catalog clip fails to load.
   */
  fallbackSongTitle?: string;
  fallbackArtistName?: string;
  /**
   * When true, immediately stops any playing clip. Used to cut audio when the
   * player submits a guess or gives up before the clip naturally ends.
   */
  forceStop?: boolean;
  /**
   * If provided, the button after a clip ends shows the next clip duration and
   * its point cost. Tapping it extends AND plays in a single tap.
   */
  nextClipInfo?: { duration: ClipDuration; cost: number; onExtend: () => void };
}

function previewUrlMap(url: string): ClipUrlMap {
  return { '1s': url, '3s': url, '5s': url, '10s': url, '30s': url };
}

function formatDuration(duration: ClipDuration): string {
  const secs = parseInt(duration, 10);
  return secs === 1 ? '1 sec' : `${secs} secs`;
}

/**
 * Wraps `AudioEngine` and renders the shrinking-multiplier background plus
 * an iOS-friendly "Start" unlock button (Web Audio contexts must be resumed
 * from a user gesture before the first `play()` call).
 *
 * Audio source priority:
 *   1. Deezer 30-second preview (primary, free, no credentials required)
 *   2. Catalog clip URLs (from seed-tracks.json)
 *   3. iTunes Search API preview (last resort)
 */
export function ClipPlayer({
  clipUrls,
  currentDuration,
  clipStartOffsetMs = 0,
  multiplier = MAX_SPEED_MULTIPLIER,
  onPlaybackStart,
  onPlaybackEnd,
  fallbackSongTitle,
  fallbackArtistName,
  forceStop = false,
  nextClipInfo,
}: ClipPlayerProps): React.ReactElement {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<ClipPlayerStatus>('loading');
  const [unlocked, setUnlocked] = useState(false);
  // Tracks whether the ▶ play button is visible. True on first load and again
  // each time the clip extends so the user taps deliberately for each clip.
  const [showPlayButton, setShowPlayButton] = useState(true);
  const [deezerPreview, setDeezerPreview] = useState<DeezerPreview | null>(null);
  const [itunesPreview, setItunesPreview] = useState<ItunesPreview | null>(null);
  const previousDuration = useRef(currentDuration);
  const stoppedRef = useRef(false);
  const usingPreviewRef = useRef(false);

  const getEngine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  // With fallback metadata: try Deezer → catalog → iTunes in order.
  useEffect(() => {
    if (!fallbackSongTitle || !fallbackArtistName) return;
    let cancelled = false;

    async function loadAudio(): Promise<void> {
      if (cancelled) return;
      setStatus('loading');

      // 1 — Deezer (primary)
      const deezer = await fetchDeezerPreview(fallbackSongTitle!, fallbackArtistName!);
      if (!cancelled && deezer) {
        try {
          await getEngine().preloadTrack(previewUrlMap(deezer.previewUrl));
          if (!cancelled) {
            usingPreviewRef.current = true;
            setDeezerPreview(deezer);
            setStatus('idle');
            return;
          }
        } catch {
          // Deezer URL unreachable — fall through to catalog
        }
      }
      if (cancelled) return;

      // 2 — Catalog clip URLs
      try {
        await getEngine().preloadTrack(clipUrls);
        if (!cancelled) {
          usingPreviewRef.current = false;
          setStatus('idle');
          return;
        }
      } catch {
        // Catalog URLs broken — fall through to iTunes
      }
      if (cancelled) return;

      // 3 — iTunes Search API (last resort)
      const itunes = await fetchItunesPreview(fallbackSongTitle!, fallbackArtistName!);
      if (!cancelled && itunes) {
        try {
          await getEngine().preloadTrack(previewUrlMap(itunes.previewUrl));
          if (!cancelled) {
            usingPreviewRef.current = true;
            setItunesPreview(itunes);
            setStatus('idle');
            return;
          }
        } catch {
          // All sources exhausted
        }
      }
      if (cancelled) return;

      setStatus('error');
      setUnlocked(true);
      onPlaybackStart();
      onPlaybackEnd();
    }

    void loadAudio();
    return (): void => { cancelled = true; };
  }, [clipUrls, getEngine, fallbackSongTitle, fallbackArtistName, onPlaybackStart, onPlaybackEnd]);

  // Without fallback metadata (e.g. the hidden preload div): use catalog URLs directly.
  useEffect(() => {
    if (fallbackSongTitle && fallbackArtistName) return;
    let cancelled = false;
    setStatus('loading');
    void getEngine()
      .preloadTrack(clipUrls)
      .then(() => { if (!cancelled) setStatus('idle'); })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setUnlocked(true);
        onPlaybackStart();
        onPlaybackEnd();
      });
    return (): void => { cancelled = true; };
  }, [clipUrls, getEngine, fallbackSongTitle, fallbackArtistName, onPlaybackStart, onPlaybackEnd]);

  const playClip = useCallback(
    async (duration: ClipDuration): Promise<void> => {
      const engine = getEngine();
      stoppedRef.current = false;
      setStatus('playing');
      onPlaybackStart();
      try {
        await engine.play(duration, usingPreviewRef.current ? 0 : clipStartOffsetMs / 1000);
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
    if (!unlocked) {
      await engine.unlock();
      setUnlocked(true);
    }
    setShowPlayButton(false);
    await playClip(currentDuration);
  }, [status, unlocked, getEngine, playClip, currentDuration]);

  // Extend + play in one tap: extends the clip duration then immediately plays
  // the new duration, bypassing the normal "show button then tap again" cycle.
  const handleExtendAndPlay = useCallback(async (): Promise<void> => {
    if (!nextClipInfo) return;
    nextClipInfo.onExtend();
    // Skip the showPlayButton cycle by updating previousDuration immediately.
    previousDuration.current = nextClipInfo.duration;
    setShowPlayButton(false);
    await playClip(nextClipInfo.duration);
  }, [nextClipInfo, playClip]);

  // When the clip duration changes (extension), show the play button again
  // with the new duration rather than auto-playing. The player taps deliberately
  // for each clip so they know what length they're committing to.
  useEffect(() => {
    if (unlocked && previousDuration.current !== currentDuration) {
      previousDuration.current = currentDuration;
      setShowPlayButton(true);
    }
  }, [currentDuration, unlocked]);

  // Stop audio immediately when the caller signals (e.g. guess submitted).
  useEffect(() => {
    if (forceStop && status === 'playing') {
      stoppedRef.current = true;
      engineRef.current?.stop();
      setStatus('ended');
      onPlaybackEnd();
    }
  }, [forceStop, status, onPlaybackEnd]);

  return (
    <div
      className="relative overflow-hidden rounded-xl p-4"
      style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}
      data-testid="clip-player"
    >
      <MultiplierBackground multiplier={multiplier} isActive={status === 'playing'} />

      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 px-4 text-center text-sm font-semibold text-amber-300"
          data-testid="clip-error"
        >
          ⚠️ Audio unavailable for this track — guess or give up to continue.
        </div>
      )}

      {/* Centered play / stop button — stays in the same position at all times */}
      <div className="flex flex-col items-center gap-2 py-5">
        {status === 'playing' ? (
          <>
            <button
              type="button"
              onClick={handleStop}
              data-testid="stop-button"
              className="flex flex-col items-center justify-center rounded-full transition-transform active:scale-95"
              style={{
                width: 76, height: 76,
                background: 'var(--color-stage)',
                border: '2px solid var(--color-stage-border)',
                color: 'var(--color-fg)',
              }}
            >
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>⏹</span>
            </button>
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {formatDuration(currentDuration)} playing
            </p>
          </>
        ) : showPlayButton && status !== 'error' ? (
          // After a clip ends with a next duration available: combine extend+play.
          // Otherwise show the standard initial play button.
          status === 'ended' && nextClipInfo ? (
            <>
              <button
                type="button"
                onClick={(): void => void handleExtendAndPlay()}
                data-testid="tap-to-start"
                className="flex flex-col items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  width: 76, height: 76,
                  background: 'var(--color-spotlight)',
                  color: 'var(--color-stage)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>▶</span>
                <span className="font-bold" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                  {formatDuration(nextClipInfo.duration)}
                </span>
              </button>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                −{nextClipInfo.cost} pts
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(): void => void handleTapToStart()}
                disabled={status === 'loading'}
                data-testid="tap-to-start"
                className="flex flex-col items-center justify-center rounded-full transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-50"
                style={{
                  width: 76, height: 76,
                  background: status === 'loading' ? 'var(--color-stage-border)' : 'var(--color-spotlight)',
                  color: status === 'loading' ? 'var(--color-fg-muted)' : 'var(--color-stage)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {status === 'loading' ? (
                  <span className="text-xs">…</span>
                ) : (
                  <>
                    <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>▶</span>
                    <span className="font-bold" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                      {formatDuration(currentDuration)}
                    </span>
                  </>
                )}
              </button>
              <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {status === 'loading' ? 'Loading audio…' : 'Tap to play'}
              </p>
            </>
          )
        ) : null}
      </div>

      {deezerPreview && (
        <DeezerBadge
          trackUrl={deezerPreview.trackUrl}
          trackName={deezerPreview.trackName}
          artistName={deezerPreview.artistName}
        />
      )}

      {!deezerPreview && itunesPreview && (
        <a
          href={itunesPreview.trackViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white hover:bg-black/80"
          data-testid="itunes-fallback-badge"
        >
          🎵 Preview via Apple Music
        </a>
      )}
    </div>
  );
}
