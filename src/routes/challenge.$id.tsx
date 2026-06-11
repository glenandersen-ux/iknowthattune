import { useEffect, useState, type JSX } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { challengeSearchSchema, type ChallengeSearch } from './searchSchemas';
import { useCatalogStore } from '../store/catalogStore';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { decodeMiniChallenge } from '../engine/UrlCodec';
import { formatEstimatedTime } from '../components/creator/TrackList';
import { difficultyLabel } from '../engine/DailyDrop';
import type { Challenge } from '../types/challenge';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/challenge/$id',
  validateSearch: challengeSearchSchema,
  loaderDeps: ({ search }: { search: ChallengeSearch }): ChallengeSearch => search,
  loader: async ({ params, deps }: { params: { id: string }; deps: ChallengeSearch }) => ({
    id: params.id,
    mini: deps.mini,
  }),
  component: ChallengeLandingRoute,
});

function ChallengeLandingRoute(): JSX.Element {
  const { id, mini } = Route.useLoaderData();
  return <ChallengeLandingScreen id={id} mini={mini} />;
}

export interface ChallengeLandingScreenProps {
  id: string;
  mini?: string;
}

function LoadingScreen(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
      <p className="text-lg">Loading…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
      <h1 className="text-2xl font-bold">Challenge Not Found</h1>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

/** Challenge landing page — what a friend sees when they tap a share link (DeepDive §B.7). */
export function ChallengeLandingScreen({ id, mini }: ChallengeLandingScreenProps): JSX.Element {
  const navigate = useNavigate();
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);
  const getTrack = useCatalogStore((state) => state.getTrack);
  const loadChallenge = useGameStore((state) => state.loadChallenge);
  const displayName = usePlayerStore((state) => state.display_name);
  const setDisplayName = usePlayerStore((state) => state.setDisplayName);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(displayName);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (mini) {
      const decoded = decodeMiniChallenge(mini);
      if (decoded) {
        setChallenge(decoded);
      } else {
        setError('This challenge link looks broken.');
      }
      return;
    }

    let cancelled = false;
    fetch(`/api/challenge/${id}`)
      .then((response) => {
        if (!response.ok) throw new Error('not found');
        return response.json() as Promise<Challenge>;
      })
      .then((data) => {
        if (!cancelled) setChallenge(data);
      })
      .catch(() => {
        if (!cancelled) setError("This challenge doesn't exist or has expired.");
      });

    return (): void => {
      cancelled = true;
    };
  }, [id, mini]);

  const handleAccept = (): void => {
    if (!challenge) return;
    const trimmed = nickname.trim();
    if (trimmed && trimmed !== displayName) setDisplayName(trimmed);
    loadChallenge(challenge, 'challenge', trimmed || displayName);
    void navigate({ to: '/game' });
  };

  if (error) return <ErrorScreen message={error} />;
  if (!challenge) return <LoadingScreen />;

  const trackCount = challenge.tracks.length;
  const difficultyScores = challenge.tracks
    .map((trackId) => getTrack(trackId)?.metadata.difficulty_score)
    .filter((score): score is number => score !== undefined);
  const avgDifficulty = difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => a + b, 0) / difficultyScores.length : null;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">{challenge.name ?? 'I Know That Tune'}</h1>
      <p className="text-center text-sm text-slate-400">Created by {challenge.creator_name}</p>

      {challenge.creator_score !== null && (
        <div className="rounded-lg bg-slate-800 p-4 text-center">
          <p className="text-sm text-slate-400">Can you beat</p>
          <p className="text-3xl font-bold text-cyan-400">{challenge.creator_score.toLocaleString()} pts</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-sm text-slate-300">
        <span>
          {trackCount} track{trackCount === 1 ? '' : 's'}
        </span>
        <span>~{formatEstimatedTime(trackCount)}</span>
        {avgDifficulty !== null && (
          <span data-testid="difficulty-badge" className="rounded-full bg-slate-800 px-3 py-1 font-semibold">
            {difficultyLabel(avgDifficulty)}
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Your Name</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter a nickname"
          className="rounded-lg bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
        />
      </label>

      <button
        type="button"
        onClick={handleAccept}
        className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
      >
        Accept Challenge
      </button>
    </div>
  );
}
