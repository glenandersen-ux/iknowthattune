import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';
import { MultiplierBackground } from './MultiplierBackground';
import { MAX_SPEED_MULTIPLIER } from '../../engine/ScoringEngine';
import { fetchSpotifyPreview, type SpotifyPreview } from '../../engine/SpotifyPreview';
import { fetchItunesPreview, type ItunesPreview } from '../../engine/ItunesPreview';
import { SpotifyBadge } from './SpotifyBadge';
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
  /**
   * Song title / primary artist used to look up Spotify (primary) and iTunes
   * (secondary) previews when the catalog clip fails to load.
   */
  fallbackSongTitle?: string;
  fallbackArtistName?: string;
}

function previewUrlMap(url: string): ClipUrlMap {
  return { '1s': url, '3s': url, '5s': url, '10s': url, '30s': url };
}

/**
 * Wraps `AudioEngine` and renders the shrinking-multiplier background plus
 * an iOS-friendly "Start" unlock button (Web Audio contexts must be resumed
 * from a user gesture before the first `play()` call).
 *
 * Audio source priority:
 *   1. Spotify 30-second preview (via /api/spotify/preview Worker endpoint)
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
}: ClipPlayerProps): React.ReactElement {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<ClipPlayerStatus>('loading');
  const [unlocked, setUnlocked] = useState(false);
  const [spotifyPreview, setSpotifyPreview] = useState<SpotifyPreview | null>(null);
  const [itunesPreview, setItunesPreview] = useState<ItunesPreview | null>(null);
  const previousDuration = useRef(currentDuration);
  const stoppedRef = useRef(false);
  // Previews use a single 30s clip for all durations; offset is always 0.
  const usingPreviewRef = useRef(false);

  const getEngine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    if (!fallbackSongTitle || !fallbackArtistName) return;
    let cancelled = false;

    async function loadAudio(): Promise<void> {
      if (cancelled) return;
      setStatus('loading');

      // 1 — Spotify (primary source)
      const spotify = await fetchSpotifyPreview(fallbackSongTitle!, fallbackArtistName!);
      if (!cancelled && spotify) {
        try {
          await getEngine().preloadTrack(previewUrlMap(spotify.previewUrl));
          if (!cancelled) {
            usingPreviewRef.current = true;
            setSpotifyPreview(spotify);
            setStatus('idle');
            return;
          }
        } catch {
          // Spotify URL bounced — fall through to catalog
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

  // For tracks with no fallback metadata (e.g. the hidden preload div), use
  // catalog URLs directly.
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

      {!unlocked && status !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
          <button
            type="button"
            onClick={(): void => void handleTapToStart()}
            disabled={status === 'loading'}
            className="rounded-full px-8 py-2 text-lg font-bold uppercase tracking-widest shadow-lg disabled:cursor-wait disabled:opacity-50"
            style={{
              background: status === 'loading' ? 'var(--color-stage-card)' : 'var(--color-spotlight)',
              color: status === 'loading' ? 'var(--color-fg-muted)' : 'var(--color-stage)',
              fontFamily: 'var(--font-display)',
            }}
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
            className="rounded-full px-6 py-1.5 text-sm font-semibold shadow-lg"
            style={{ background: 'var(--color-stage)', color: 'var(--color-fg)', border: '1px solid var(--color-stage-border)' }}
            data-testid="stop-button"
          >
            Stop
          </button>
        </div>
      )}

      {/* Spotify badge — required by Spotify Developer Policy when using preview clips */}
      {spotifyPreview && (
        <SpotifyBadge
          trackUrl={spotifyPreview.trackUrl}
          trackName={spotifyPreview.trackName}
          artistName={spotifyPreview.artistName}
        />
      )}

      {/* iTunes badge — shown only when Spotify wasn't available */}
      {!spotifyPreview && itunesPreview && (
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
