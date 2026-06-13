import { useEffect, useMemo, useState, type JSX } from 'react';
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
  pickRandomTracks,
} from '../engine/SoloSprint';

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

function formatGenre(value: string[] | string | null): string {
  if (value === null) return 'Unknown';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Unknown';
  return value;
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
    void navigate({ to: '/game', search: { mode: 'daily', seed: trackId, date } });
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
    const selected = pickRandomTracks(pool, trackCount);
    if (selected.length === 0) return;
    void navigate({ to: '/game', search: { mode: 'solo', seed: buildSoloSprintSeed(selected) } });
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-4 text-center text-white">
      <h1 className="text-3xl font-bold">I Know That Tune</h1>

      {dailyStreak > 0 && (
        <p className="text-sm text-amber-400">🔥 {dailyStreak}-day streak — keep it going!</p>
      )}

      <div className="flex w-full flex-col gap-4 rounded-lg bg-slate-800 p-6">
        <h2 className="text-lg font-semibold">Today&apos;s Drop</h2>
        {track ? (
          <>
            <div className="flex justify-center gap-2">
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                {formatGenre(track.answers.genre.value)}
              </span>
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                {difficultyLabel(track.metadata.difficulty_score)}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePlay}
              className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
            >
              Play Today&apos;s Drop
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-lg bg-slate-800 p-6 text-left">
        <h2 className="text-center text-lg font-semibold">Solo Sprint</h2>

        {genres.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Genre</p>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  aria-pressed={selectedGenres.includes(genre)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    selectedGenres.includes(genre) ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {decades.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Decade</p>
            <div className="flex flex-wrap gap-2">
              {decades.map((decade) => (
                <button
                  key={decade}
                  type="button"
                  onClick={() => toggleDecade(decade)}
                  aria-pressed={selectedDecades.includes(decade)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    selectedDecades.includes(decade) ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {decade}s
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="solo-artist" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Artist
          </label>
          <input
            id="solo-artist"
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Any artist"
            className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        <div>
          <label htmlFor="solo-track-count" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tracks: {trackCount}
          </label>
          <input
            id="solo-track-count"
            type="range"
            min={MIN_SOLO_TRACKS}
            max={MAX_SOLO_TRACKS}
            value={trackCount}
            onChange={(e) => setTrackCount(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          type="button"
          onClick={handleStartSoloSprint}
          className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
        >
          Start Solo Sprint
        </button>
      </div>
    </div>
  );
}
