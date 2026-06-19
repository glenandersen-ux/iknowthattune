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
import { AppleMusicLink } from '../components/result/AppleMusicLink';
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
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center" style={{ color: 'var(--color-fg)' }}>
        <h1 className="text-3xl uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>No results yet</h1>
        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Play a game to see your score here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4" style={{ color: 'var(--color-fg)' }}>
      {/* header */}
      <div className="pt-8 text-center">
        <p className="mb-1 text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--color-fg-muted)' }}>{challengeName}</p>
        <h1 className="text-4xl uppercase" style={{ fontFamily: 'var(--font-display)', color: '#fff' }}>Your Results</h1>
        <p className="mt-2 text-5xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-spotlight)' }}>
          {Math.round(session.totals.total_score).toLocaleString()}
        </p>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>total points</p>
      </div>

      {/* per-track table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-stage-border)' }}>
        <table className="w-full table-auto text-left text-xs">
          <thead>
            <tr style={{ background: 'var(--color-stage-card)', color: 'var(--color-fg-muted)' }}>
              <th className="px-3 py-2">Track</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-center">1st?</th>
              <th className="px-3 py-2 text-right">Clips</th>
              <th className="px-3 py-2 text-right">Fields</th>
              <th className="px-3 py-2 text-center">Listen</th>
            </tr>
          </thead>
          <tbody>
            {session.tracks.map((track) => {
              const score = Math.max(0, track.raw_score + track.clip_penalty_applied);
              const trackData = getTrack(track.track_id);
              const title = trackData?.answers.song_title.value ?? track.track_id;
              const artist = trackData?.answers.primary_artist.value;
              return (
                <tr
                  key={track.track_id}
                  style={{ borderTop: '1px solid var(--color-stage-border)', background: 'var(--color-stage)' }}
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-fg)' }}>{title}</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ color: 'var(--color-spotlight)', fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>
                    {Math.round(score).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center">{track.first_guess_bonus_earned ? '✅' : '❌'}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: 'var(--color-fg-muted)' }}>{formatClipsUsed(track.clip_sequence_used)}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: 'var(--color-fg-muted)' }}>
                    {track.fields_correct.length}/{track.fields_attempted.length}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {trackData?.answers.song_title.value && artist && (
                      <AppleMusicLink songTitle={trackData.answers.song_title.value} artistName={artist} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-stage-border)', background: 'var(--color-stage-card)' }}>
              <td className="px-3 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>TOTAL</td>
              <td className="px-3 py-2.5 text-right font-bold" style={{ color: 'var(--color-spotlight)', fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>
                {Math.round(session.totals.total_score).toLocaleString()}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* vs challenger */}
      {session.comparison && (
        <div
          className="rounded-xl p-4 text-center font-semibold"
          style={
            session.comparison.result === 'win'
              ? { background: 'rgba(74,222,128,0.1)', border: '1px solid var(--color-correct)', color: 'var(--color-correct)' }
              : session.comparison.result === 'loss'
                ? { background: 'rgba(248,113,113,0.1)', border: '1px solid var(--color-incorrect)', color: 'var(--color-incorrect)' }
                : { background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg-muted)' }
          }
        >
          vs. {session.comparison.challenger_name}: {session.comparison.challenger_score.toLocaleString()} pts
          {session.comparison.result === 'win' &&
            ` — YOU WIN by ${Math.abs(session.comparison.margin).toLocaleString()} pts!`}
          {session.comparison.result === 'loss' &&
            ` — You lost by ${Math.abs(session.comparison.margin).toLocaleString()} pts`}
          {session.comparison.result === 'tie' && ' — Tied!'}
        </div>
      )}

      {/* action buttons */}
      <div className="flex flex-col gap-2 pb-8">
        <button
          type="button"
          onClick={handleCopyEmojiGrid}
          className="rounded-xl px-4 py-3.5 text-sm font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg)' }}
        >
          📋 Copy Emoji Grid
        </button>
        <button
          type="button"
          onClick={(): void => void handleDownloadCard()}
          className="rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-spotlight)', color: 'var(--color-stage)', fontFamily: 'var(--font-display)' }}
        >
          ⬇️ Download Card
        </button>
        <a ref={downloadLinkRef} className="hidden" aria-hidden="true">
          download
        </a>
        {challenge && !CLIENT_ONLY_CHALLENGE_IDS.has(challenge.id) && (
          <a
            href={`/leaderboard?c=${challenge.id}`}
            className="rounded-xl px-4 py-3.5 text-center text-sm font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)', color: 'var(--color-fg)' }}
          >
            🏆 View Leaderboard
          </a>
        )}
        {session.mode === 'solo' && challenge && !showShareChallenge && (
          <button
            type="button"
            onClick={() => setShowShareChallenge(true)}
            className="rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-violet), var(--color-violet-dim))', color: '#fff', fontFamily: 'var(--font-display)' }}
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
