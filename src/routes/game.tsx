import { useEffect, useRef, type JSX } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { gameSearchSchema, type GameSearch } from './searchSchemas';
import { useGameStore } from '../store/gameStore';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { ClipPlayer } from '../components/game/ClipPlayer';
import { ClipExtendBar } from '../components/game/ClipExtendBar';
import { SpeedMultiplierBadge } from '../components/game/SpeedMultiplierBadge';
import { GuessPanel } from '../components/game/GuessPanel';
import { buildSoloChallenge } from '../engine/ChallengeBuilder';
import { FIELD_DEFINITIONS } from '../engine/ScoringEngine';
import type { FieldId, Track } from '../types/track';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/game',
  validateSearch: gameSearchSchema,
  loaderDeps: ({ search }: { search: GameSearch }): GameSearch => search,
  loader: async ({ deps }: { deps: GameSearch }): Promise<GameSearch> => deps,
  component: GameRoute,
});

function GameRoute(): JSX.Element {
  const search = Route.useSearch();
  return <GameScreen search={search} />;
}

/** Renders the canonical answer for a field as a display string. */
function formatAnswer(track: Track, fieldId: FieldId): string {
  const value = track.answers[fieldId].value;
  if (value === null) return '—';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  return String(value);
}

function LoadingScreen(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center text-white">
      <p className="text-lg">Loading…</p>
    </div>
  );
}

interface RevealScreenProps {
  track: Track;
  activeFields: FieldId[];
  trackNumber: number;
  trackCount: number;
  scoreEarned: number;
  fieldsCorrect: FieldId[];
  isLastTrack: boolean;
  onContinue: () => void;
  /** The upcoming track, preloaded silently while the player reviews this reveal screen. */
  nextTrack?: Track;
}

function RevealScreen({
  track,
  activeFields,
  trackNumber,
  trackCount,
  scoreEarned,
  fieldsCorrect,
  isLastTrack,
  onContinue,
  nextTrack,
}: RevealScreenProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-xl font-bold">
        Track {trackNumber} of {trackCount}
      </h1>
      <div className="rounded-lg bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Score earned</p>
        <p className="text-3xl font-bold text-cyan-400">{Math.round(scoreEarned)}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {activeFields.map((fieldId) => {
          const correct = fieldsCorrect.includes(fieldId);
          return (
            <li
              key={fieldId}
              className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
            >
              <span className="text-sm text-slate-300">{FIELD_DEFINITIONS[fieldId].label}</span>
              <span className={correct ? 'text-green-400' : 'text-red-400'}>
                {formatAnswer(track, fieldId)} {correct ? '✓' : '✗'}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onContinue}
        className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
        data-testid="continue-button"
      >
        {isLastTrack ? 'See Results' : 'Next Track'}
      </button>
      {nextTrack && (
        <div className="hidden" aria-hidden="true">
          <ClipPlayer
            key={`preload-${nextTrack.track_id}`}
            clipUrls={nextTrack.clip_urls}
            currentDuration="1s"
            onPlaybackStart={(): void => {}}
            onPlaybackEnd={(): void => {}}
            onExtendRequest={(): void => {}}
          />
        </div>
      )}
    </div>
  );
}

export interface GameScreenProps {
  search: GameSearch;
}

/** The full Daily Drop / Solo Sprint guess-loop state machine (Blueprint §6). */
export function GameScreen({ search }: GameScreenProps): JSX.Element {
  const navigate = useNavigate();

  const tracks = useCatalogStore((state) => state.tracks);
  const fieldTries = useCatalogStore((state) => state.fieldTries);
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);
  const getTrack = useCatalogStore((state) => state.getTrack);

  const challenge = useGameStore((state) => state.challenge);
  const phase = useGameStore((state) => state.phase);
  const currentTrackIndex = useGameStore((state) => state.currentTrackIndex);
  const activeClipDuration = useGameStore((state) => state.activeClipDuration);
  const speedMultiplier = useGameStore((state) => state.speedMultiplier);
  const clipExtensions = useGameStore((state) => state.clipExtensions);
  const session = useGameStore((state) => state.session);
  const loadChallenge = useGameStore((state) => state.loadChallenge);
  const startTrack = useGameStore((state) => state.startTrack);
  const tick = useGameStore((state) => state.tick);
  const clipEnded = useGameStore((state) => state.clipEnded);
  const resumePlaying = useGameStore((state) => state.resumePlaying);
  const submitGuess = useGameStore((state) => state.submitGuess);
  const extendClip = useGameStore((state) => state.extendClip);
  const skipTrack = useGameStore((state) => state.skipTrack);
  const advanceTrack = useGameStore((state) => state.advanceTrack);

  const playerId = usePlayerStore((state) => state.player_id);
  const playerName = usePlayerStore((state) => state.display_name);
  const updateAfterGame = usePlayerStore((state) => state.updateAfterGame);

  const trackStartRef = useRef<number | null>(null);
  const updatedAfterGameRef = useRef(false);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (challenge || tracks.length === 0) return;
    const seedIds = search.seed?.split(',').filter((id) => id.length > 0);
    const selected =
      seedIds && seedIds.length > 0
        ? seedIds.map((id) => getTrack(id)).filter((t): t is Track => t !== undefined)
        : tracks;
    if (selected.length === 0) return;
    const mode = search.mode === 'daily' ? 'daily' : 'solo';
    loadChallenge(buildSoloChallenge(selected, mode, playerId), mode, playerName);
  }, [challenge, tracks, search.seed, search.mode, getTrack, loadChallenge, playerId, playerName]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'guessing') return;
    let frameId: number;
    const loop = (): void => {
      if (trackStartRef.current !== null) {
        tick(performance.now() - trackStartRef.current);
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return (): void => cancelAnimationFrame(frameId);
  }, [phase, tick]);

  useEffect(() => {
    if (phase !== 'complete' || updatedAfterGameRef.current) return;
    updatedAfterGameRef.current = true;
    updateAfterGame(session);
    void navigate({ to: '/result' });
  }, [phase, session, updateAfterGame, navigate]);

  if (!challenge) {
    return <LoadingScreen />;
  }

  const trackId = challenge.tracks[currentTrackIndex];
  const track = getTrack(trackId);
  if (!track) {
    return <LoadingScreen />;
  }

  const activeFields = challenge.active_params[trackId] ?? [];
  const trackCount = challenge.tracks.length;
  const nextTrackId = challenge.tracks[currentTrackIndex + 1];
  const nextTrack = nextTrackId ? getTrack(nextTrackId) : undefined;

  const handlePlaybackStart = (): void => {
    if (phase === 'idle') {
      trackStartRef.current = performance.now();
      startTrack();
    } else {
      resumePlaying();
    }
  };

  if (phase === 'reveal') {
    const lastTrack = session.tracks[session.tracks.length - 1];
    return (
      <RevealScreen
        track={track}
        activeFields={activeFields}
        trackNumber={currentTrackIndex + 1}
        trackCount={trackCount}
        scoreEarned={Math.max(0, lastTrack.raw_score + lastTrack.clip_penalty_applied)}
        fieldsCorrect={lastTrack.fields_correct}
        isLastTrack={currentTrackIndex + 1 >= trackCount}
        onContinue={advanceTrack}
        nextTrack={nextTrack}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 text-white">
      <h1 className="text-center text-xl font-bold">
        Track {currentTrackIndex + 1} of {trackCount}
      </h1>
      <ClipPlayer
        key={trackId}
        clipUrls={track.clip_urls}
        currentDuration={activeClipDuration}
        onPlaybackStart={handlePlaybackStart}
        onPlaybackEnd={clipEnded}
        onExtendRequest={(): void => {}}
      />
      <div className="flex items-center justify-between">
        <SpeedMultiplierBadge multiplier={speedMultiplier} />
        <ClipExtendBar currentDuration={activeClipDuration} clipExtensions={clipExtensions} onExtend={extendClip} />
      </div>
      <GuessPanel
        track={track}
        activeFields={activeFields}
        fieldTries={fieldTries}
        onSubmit={(_results, guesses): void => submitGuess(guesses)}
        onGiveUp={skipTrack}
      />
    </div>
  );
}
