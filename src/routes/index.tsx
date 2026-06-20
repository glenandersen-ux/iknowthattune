import { useEffect, useMemo, useState, type JSX, type CSSProperties } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { gameSearchSchema, type GameSearch } from './searchSchemas';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { difficultyLabel, fetchDailyTrackOverride, getDailyTrackId, todayIso } from '../engine/DailyDrop';
import {
  buildSoloSprintSeed,
  DEFAULT_SOLO_TRACKS,
  filterTracksForSoloSprint,
  listDecades,
  listGenres,
  MAX_SOLO_TRACKS,
  MIN_SOLO_TRACKS,
  pickFreshTracks,
} from '../engine/SoloSprint';
import { encodeSeed } from '../engine/UrlCodec';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: gameSearchSchema,
  loaderDeps: ({ search }: { search: GameSearch }): GameSearch => search,
  loader: async ({ deps }: { deps: GameSearch }): Promise<GameSearch> => deps,
  component: HomeRoute,
});

function HomeRoute(): JSX.Element {
  return <HomeScreen />;
}

/** Animated equalizer bars — the ambient stage atmosphere behind the hero. */
function EqualizerHero(): JSX.Element {
  const BAR_COUNT = 40;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => i);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-[3px] overflow-hidden px-4 pb-0">
      {bars.map((i) => {
        const duration = 0.6 + (i % 7) * 0.18;
        const delay = (i % 11) * 0.09;
        const heightPct = 20 + (i % 9) * 9;
        return (
          <div
            key={i}
            style={
              {
                height: `${heightPct}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                transformOrigin: 'bottom',
                '--tw-bg-opacity': '1',
              } as CSSProperties
            }
            className="w-[3px] flex-shrink-0 animate-[equalizer_linear_infinite] rounded-t-sm bg-violet/30"
          />
        );
      })}
      {/* second layer slightly brighter, offset phase */}
      {bars.map((i) => {
        const duration = 0.5 + (i % 5) * 0.22;
        const delay = 0.3 + (i % 8) * 0.11;
        return (
          <div
            key={`b${i}`}
            style={
              {
                height: `${15 + (i % 6) * 12}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                transformOrigin: 'bottom',
                position: 'absolute',
              } as CSSProperties
            }
            className="w-[2px] animate-[equalizer_linear_infinite] rounded-t-sm bg-spotlight/10"
          />
        );
      })}
    </div>
  );
}

function formatGenre(value: string[] | string | null): string {
  if (value === null) return 'Unknown';
  if (Array.isArray(value)) return value.length > 0 ? value.join(' · ') : 'Unknown';
  return value;
}

function DifficultyDots({ score }: { score: number }): JSX.Element {
  const filled = Math.round(score * 2);
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < filled ? 'bg-spotlight' : 'bg-stage-border'}`} />
      ))}
    </span>
  );
}

export function HomeScreen(): JSX.Element {
  const navigate = useNavigate();
  const allTracks = useCatalogStore((state) => state.tracks);
  const unplayableTrackIds = useCatalogStore((state) => state.unplayableTrackIds);
  const tracks = useMemo(
    () => allTracks.filter((track) => !unplayableTrackIds.has(track.track_id)),
    [allTracks, unplayableTrackIds],
  );
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);
  const dailyStreak = usePlayerStore((state) => state.daily_drop_streak);
  const recentlyPlayedIds = usePlayerStore((state) => state.recently_played_track_ids);

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [artist, setArtist] = useState('');
  const [trackCount, setTrackCount] = useState(DEFAULT_SOLO_TRACKS);
  const [overrideTrackId, setOverrideTrackId] = useState<string | null>(null);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const date = todayIso();

  useEffect(() => {
    void fetchDailyTrackOverride(date).then(setOverrideTrackId);
  }, [date]);

  const hasOverride = overrideTrackId !== null && tracks.some((t) => t.track_id === overrideTrackId);
  const trackId = hasOverride ? overrideTrackId : getDailyTrackId(tracks, date);
  const track = trackId ? tracks.find((t) => t.track_id === trackId) : undefined;

  const handlePlay = (): void => {
    if (!trackId) return;
    void navigate({ to: '/game', search: { mode: 'daily', seed: encodeSeed(trackId), date } });
  };

  const genres = listGenres(tracks);
  const decades = listDecades(tracks);

  const toggleGenre = (genre: string): void => {
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const toggleDecade = (decade: number): void => {
    setSelectedDecades((prev) => (prev.includes(decade) ? prev.filter((d) => d !== decade) : [...prev, decade]));
  };

  const handleStartSoloSprint = (): void => {
    const filtered = filterTracksForSoloSprint(tracks, { genres: selectedGenres, decades: selectedDecades, artist });
    const pool = filtered.length > 0 ? filtered : tracks;
    const selected = pickFreshTracks(pool, recentlyPlayedIds, trackCount);
    if (selected.length === 0) return;
    void navigate({ to: '/game', search: { mode: 'solo', seed: encodeSeed(buildSoloSprintSeed(selected)) } });
  };

  return (
    <div className="min-h-svh" style={{ background: 'var(--color-stage)', fontFamily: 'var(--font-body)' }}>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-8 text-center">
        <EqualizerHero />

        {/* gradient fade at top so bars don't compete with the headline */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{ background: 'linear-gradient(to bottom, var(--color-stage) 40%, transparent)' }}
        />
        {/* gradient fade at bottom */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{ background: 'linear-gradient(to top, var(--color-stage) 30%, transparent)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* eyebrow */}
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: 'var(--color-violet)', fontFamily: 'var(--font-body)' }}
          >
            Daily Drop · Music Trivia
          </p>

          {/* headline */}
          <h1
            className="leading-none tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 14vw, 7rem)',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            Hear it.
            <br />
            <span style={{ color: 'var(--color-spotlight)' }}>Know it.</span>
          </h1>

          {/* sub-headline */}
          <p className="max-w-xs text-base" style={{ color: 'var(--color-fg-muted)' }}>
            One clip. One second. How fast can you name the song?
          </p>

          {/* streak badge */}
          {dailyStreak > 0 && (
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-spotlight)' }}
            >
              🔥 {dailyStreak}-day streak
            </div>
          )}

          {/* daily drop CTA */}
          {track ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>
                Today&apos;s Drop
              </p>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                <span
                  className="rounded-full px-3 py-1 font-semibold uppercase tracking-wider"
                  style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}
                >
                  {formatGenre(track.answers.genre.value)}
                </span>
                <DifficultyDots score={track.metadata.difficulty_score} />
                <span>{difficultyLabel(track.metadata.difficulty_score)}</span>
              </div>

              <button
                type="button"
                onClick={handlePlay}
                aria-label="Play Today's Drop"
                className="group relative w-full overflow-hidden rounded-2xl px-8 py-5 text-xl font-bold uppercase tracking-widest transition-transform active:scale-95"
                style={{
                  background: 'var(--color-spotlight)',
                  color: 'var(--color-stage)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                    style={{ background: 'var(--color-stage)', color: 'var(--color-spotlight)' }}
                  >
                    ▶
                  </span>
                  Play Today's Drop
                  <span
                    className="rounded-md px-2 py-0.5 text-sm"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  >
                    1s
                  </span>
                </span>
                {/* shimmer on hover */}
                <span
                  className="absolute inset-0 -translate-x-full skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]"
                  style={{ background: 'rgba(255,255,255,0.2)', width: '60%' }}
                />
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl px-10 py-5 text-sm"
              style={{ background: 'var(--color-stage-card)', color: 'var(--color-fg-muted)' }}
            >
              Loading today's track…
            </div>
          )}
        </div>
      </section>

      {/* ── VALUE PROPS ──────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-lg grid-cols-3 gap-3 px-4 pb-12">
        {[
          { icon: '⚡', stat: '1s', label: 'to recognize a song' },
          { icon: '📅', stat: 'Daily', label: 'new drop every day' },
          { icon: '🏆', stat: 'Beat', label: "your friends' scores" },
        ].map(({ icon, stat, label }) => (
          <div
            key={stat}
            className="flex flex-col items-center gap-1 rounded-xl px-3 py-5 text-center"
            style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}
          >
            <span className="text-2xl">{icon}</span>
            <span
              className="text-2xl font-bold leading-none"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-spotlight)' }}
            >
              {stat}
            </span>
            <span className="text-xs leading-snug" style={{ color: 'var(--color-fg-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </section>

      {/* ── SOLO SPRINT ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-lg px-4 pb-16">
        {/* divider matching the hero eyebrow style */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: 'var(--color-stage-border)' }} />
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: 'var(--color-violet)', fontFamily: 'var(--font-body)' }}
          >
            Solo Sprint
          </p>
          <div className="h-px flex-1" style={{ background: 'var(--color-stage-border)' }} />
        </div>

        <h2
          className="mb-8 text-center leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 10vw, 4.5rem)',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          Pick your<br />
          <span style={{ color: 'var(--color-spotlight)' }}>playlist.</span>
        </h2>

        <div className="flex flex-col gap-6">
          {genres.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>
                Genre
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    aria-pressed={selectedGenres.includes(genre)}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                    style={
                      selectedGenres.includes(genre)
                        ? { background: 'var(--color-spotlight)', color: 'var(--color-stage)', fontFamily: 'var(--font-body)' }
                        : { background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-body)' }
                    }
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {decades.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>
                Decade
              </p>
              <div className="flex flex-wrap gap-2">
                {decades.map((decade) => (
                  <button
                    key={decade}
                    type="button"
                    onClick={() => toggleDecade(decade)}
                    aria-pressed={selectedDecades.includes(decade)}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                    style={
                      selectedDecades.includes(decade)
                        ? { background: 'var(--color-spotlight)', color: 'var(--color-stage)', fontFamily: 'var(--font-body)' }
                        : { background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-body)' }
                    }
                  >
                    {decade}s
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="solo-artist"
              className="mb-3 block text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-fg-muted)' }}
            >
              Artist
            </label>
            <input
              id="solo-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Any artist"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                background: 'var(--color-stage-card)',
                border: '1px solid var(--color-stage-border)',
                color: 'var(--color-fg)',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label
                htmlFor="solo-track-count"
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                Tracks
              </label>
              <span
                className="text-2xl font-bold leading-none"
                style={{ color: 'var(--color-spotlight)', fontFamily: 'var(--font-display)' }}
              >
                {trackCount}
              </span>
            </div>
            <input
              id="solo-track-count"
              type="range"
              min={MIN_SOLO_TRACKS}
              max={MAX_SOLO_TRACKS}
              value={trackCount}
              onChange={(e) => setTrackCount(Number(e.target.value))}
              className="w-full accent-[#D4FF00]"
            />
          </div>

          <button
            type="button"
            onClick={handleStartSoloSprint}
            aria-label="Start Solo Sprint"
            className="group relative w-full overflow-hidden rounded-2xl px-8 py-5 text-xl font-bold uppercase tracking-widest transition-transform active:scale-95"
            style={{
              background: 'var(--color-spotlight)',
              color: 'var(--color-stage)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                style={{ background: 'var(--color-stage)', color: 'var(--color-spotlight)' }}
              >
                ▶
              </span>
              Start Solo Sprint
            </span>
            <span
              className="absolute inset-0 -translate-x-full skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]"
              style={{ background: 'rgba(255,255,255,0.2)', width: '60%' }}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
