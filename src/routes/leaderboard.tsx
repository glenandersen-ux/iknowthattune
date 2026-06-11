import { useEffect, useState, type JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { leaderboardSearchSchema, type LeaderboardSearch } from './searchSchemas';
import { usePlayerStore } from '../store/playerStore';
import type { PlayerResult } from '../types/challenge';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  validateSearch: leaderboardSearchSchema,
  loaderDeps: ({ search }: { search: LeaderboardSearch }): LeaderboardSearch => search,
  loader: async ({ deps }: { deps: LeaderboardSearch }): Promise<LeaderboardSearch> => deps,
  component: LeaderboardRoute,
});

function LeaderboardRoute(): JSX.Element {
  const { c } = Route.useLoaderData();
  return <LeaderboardScreen challengeId={c} />;
}

export interface LeaderboardScreenProps {
  challengeId: string;
}

function LoadingScreen(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
      <p className="text-lg">Loading…</p>
    </div>
  );
}

/** Per-challenge leaderboard (Blueprint §10), ranked by score then duration. */
export function LeaderboardScreen({ challengeId }: LeaderboardScreenProps): JSX.Element {
  const playerId = usePlayerStore((state) => state.player_id);

  const [entries, setEntries] = useState<PlayerResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/challenge/${challengeId}/leaderboard`)
      .then((response) => {
        if (!response.ok) throw new Error('not found');
        return response.json() as Promise<PlayerResult[]>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError("This leaderboard isn't available right now.");
      });

    return (): void => {
      cancelled = true;
    };
  }, [challengeId]);

  const handleShare = (): void => {
    void navigator.clipboard.writeText(`${window.location.origin}/leaderboard?c=${challengeId}`);
    setCopied(true);
  };

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
        <h1 className="text-2xl font-bold">Leaderboard Unavailable</h1>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  if (entries === null) return <LoadingScreen />;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">Leaderboard</h1>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-slate-400">No results yet — be the first to play!</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentPlayer = entry.playerId === playerId;
            return (
              <li
                key={entry.playerId}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  isCurrentPlayer ? 'bg-cyan-900 ring-1 ring-cyan-400' : 'bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-bold text-slate-400">{rank}</span>
                  <span className="font-semibold">
                    {entry.playerName}
                    {isCurrentPlayer ? ' (you)' : ''}
                  </span>
                </span>
                <span className="font-bold text-cyan-400">{entry.score.toLocaleString()} pts</span>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={handleShare}
        className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600"
      >
        {copied ? 'Copied!' : '🔗 Share Leaderboard'}
      </button>
    </div>
  );
}
