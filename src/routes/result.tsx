import { useRef, useState, type JSX } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { resultSearchSchema, type ResultSearch } from './searchSchemas';
import { useGameStore } from '../store/gameStore';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { buildEmojiGrid } from '../engine/ShareText';
import { trackEvent } from '../engine/Analytics';
import { BadgeUnlock } from '../components/result/BadgeUnlock';
import { PublishScreen } from '../components/creator/PublishScreen';
import type { ClipDuration } from '../types/track';
import type { Challenge } from '../types/challenge';
import type { PlayerSession } from '../types/session';

/** Challenge IDs used for client-only modes that have no server-side leaderboard. */
const CLIENT_ONLY_CHALLENGE_IDS = new Set(['daily-drop', 'solo-sprint', 'preview']);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/result',
  validateSearch: resultSearchSchema,
  loaderDeps: ({ search }: { search: ResultSearch }): ResultSearch => search,
  loader: async ({ deps }: { deps: ResultSearch }): Promise<ResultSearch> => deps,
  component: ResultRoute,
});

function ResultRoute(): JSX.Element {
  return <ResultScreen />;
}

/** Describes how many clips were played for a track, e.g. "1s only" or "5s used". */
function formatClipsUsed(sequence: ClipDuration[]): string {
  const last = sequence[sequence.length - 1] ?? '1s';
  return sequence.length <= 1 ? `${last} only` : `${last} used`;
}

interface ShareCardTemplateProps {
  session: PlayerSession;
  challengeName: string;
}

/** Off-screen card captured by html2canvas for the downloadable share image. */
function ShareCardTemplate({ session, challengeName }: ShareCardTemplateProps): JSX.Element {
  return (
    <div
      id="share-card-template"
      className="fixed -left-[9999px] top-0 h-[315px] w-[600px] bg-gray-950 p-6 font-mono"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-green-400">🎵 I KNOW THAT TUNE</p>
          <h2 className="mt-1 text-xl font-bold text-white">{challengeName}</h2>
        </div>
        <p className="text-3xl font-bold text-white">{session.totals.total_score.toLocaleString()}</p>
      </div>
      <div className="mt-4 space-y-1">
        {session.tracks.map((track) => (
          <div key={track.track_id} className="flex gap-1">
            {track.fields_attempted.map((field) => (
              <span
                key={field}
                className={track.fields_correct.includes(field) ? 'text-green-400' : 'text-red-500'}
              >
                █
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultScreen(): JSX.Element {
  const session = useGameStore((state) => state.session);
  const challenge = useGameStore((state) => state.challenge);
  const getTrack = useCatalogStore((state) => state.getTrack);
  const playerId = usePlayerStore((state) => state.player_id);
  const playerName = usePlayerStore((state) => state.display_name);
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [showShareChallenge, setShowShareChallenge] = useState(false);

  const challengeName = challenge?.name ?? 'I Know That Tune';

  const handleCopyEmojiGrid = (): void => {
    void navigator.clipboard.writeText(buildEmojiGrid(session, challengeName));
  };

  const handleDownloadCard = async (): Promise<void> => {
    const element = document.getElementById('share-card-template');
    if (!element) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f0f0f',
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const link = downloadLinkRef.current;
    if (!link) return;
    link.href = dataUrl;
    link.download = 'iknowthattune-result.png';
    link.click();
    trackEvent('share_card_downloaded');
  };

  if (session.tracks.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
        <h1 className="text-2xl font-bold">No results yet</h1>
        <p className="text-sm text-slate-400">Play a game to see your score here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">Your Results</h1>
      <p className="text-center text-sm text-slate-400">{challengeName}</p>

      <table className="w-full table-auto text-left text-sm">
        <thead>
          <tr className="text-slate-400">
            <th className="py-1">Track</th>
            <th className="py-1 text-right">Score</th>
            <th className="py-1 text-center">1st?</th>
            <th className="py-1 text-right">Clips</th>
            <th className="py-1 text-right">Params</th>
          </tr>
        </thead>
        <tbody>
          {session.tracks.map((track) => {
            const score = Math.max(0, track.raw_score + track.clip_penalty_applied);
            const trackData = getTrack(track.track_id);
            const title = trackData?.answers.song_title.value ?? track.track_id;
            return (
              <tr key={track.track_id} className="border-t border-slate-800">
                <td className="py-2">{title}</td>
                <td className="py-2 text-right">{Math.round(score).toLocaleString()}</td>
                <td className="py-2 text-center">{track.first_guess_bonus_earned ? '✅' : '❌'}</td>
                <td className="py-2 text-right">{formatClipsUsed(track.clip_sequence_used)}</td>
                <td className="py-2 text-right">
                  {track.fields_correct.length}/{track.fields_attempted.length}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-700 font-bold">
            <td className="py-2">TOTAL</td>
            <td className="py-2 text-right">{Math.round(session.totals.total_score).toLocaleString()}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>

      {session.comparison && (
        <div
          className={`rounded-lg p-3 text-center font-semibold ${
            session.comparison.result === 'win'
              ? 'bg-green-900 text-green-300'
              : session.comparison.result === 'loss'
                ? 'bg-red-900 text-red-300'
                : 'bg-slate-800 text-slate-300'
          }`}
        >
          vs. {session.comparison.challenger_name}: {session.comparison.challenger_score.toLocaleString()} pts
          {session.comparison.result === 'win' &&
            ` — YOU WIN by ${Math.abs(session.comparison.margin).toLocaleString()} pts!`}
          {session.comparison.result === 'loss' &&
            ` — You lost by ${Math.abs(session.comparison.margin).toLocaleString()} pts`}
          {session.comparison.result === 'tie' && ' — Tied!'}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCopyEmojiGrid}
          className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600"
        >
          📋 Copy Emoji Grid
        </button>
        <button
          type="button"
          onClick={(): void => void handleDownloadCard()}
          className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
        >
          ⬇️ Download Card
        </button>
        <a ref={downloadLinkRef} className="hidden" aria-hidden="true">
          download
        </a>
        {challenge && !CLIENT_ONLY_CHALLENGE_IDS.has(challenge.id) && (
          <a
            href={`/leaderboard?c=${challenge.id}`}
            className="rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-white hover:bg-slate-600"
          >
            🏆 View Leaderboard
          </a>
        )}
        {session.mode === 'solo' && challenge && !showShareChallenge && (
          <button
            type="button"
            onClick={() => setShowShareChallenge(true)}
            className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600"
          >
            🔗 Share This as a Challenge
          </button>
        )}
      </div>

      {session.mode === 'solo' && challenge && showShareChallenge && (
        <div className="rounded-lg bg-slate-800 p-4">
          <PublishScreen
            challenge={
              {
                ...challenge,
                creator_name: playerName,
                creator_player_id: playerId,
                creator_score: session.totals.total_score,
                name: 'Solo Sprint Challenge',
              } satisfies Challenge
            }
            hasPlayed
            onPlayNow={() => {}}
          />
        </div>
      )}

      <ShareCardTemplate session={session} challengeName={challengeName} />
      <BadgeUnlock badges={session.unlocked_badges ?? []} />
    </div>
  );
}
