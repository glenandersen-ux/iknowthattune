import { useEffect, type JSX } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { gameSearchSchema, type GameSearch } from './searchSchemas';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { difficultyLabel, getDailyTrackId, todayIso } from '../engine/DailyDrop';

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
  const tracks = useCatalogStore((state) => state.tracks);
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);
  const dailyStreak = usePlayerStore((state) => state.daily_drop_streak);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const date = todayIso();
  const trackId = getDailyTrackId(tracks, date);
  const track = trackId ? tracks.find((t) => t.track_id === trackId) : undefined;

  const handlePlay = (): void => {
    if (!trackId) return;
    void navigate({ to: '/game', search: { mode: 'daily', seed: trackId, date } });
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
    </div>
  );
}
