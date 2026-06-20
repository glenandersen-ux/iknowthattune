import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { gameSearchSchema, type GameSearch } from './searchSchemas';
import { useGameStore } from '../store/gameStore';
import { useCatalogStore } from '../store/catalogStore';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { ClipPlayer } from '../components/game/ClipPlayer';
import { ClipExtendBar } from '../components/game/ClipExtendBar';
import { SpeedMultiplierBadge } from '../components/game/SpeedMultiplierBadge';
import { GuessPanel } from '../components/game/GuessPanel';
import { buildSoloChallenge, buildMicroChallenge } from '../engine/ChallengeBuilder';
import { trackEvent } from '../engine/Analytics';
import { FIELD_DEFINITIONS, computeStreakBonus } from '../engine/ScoringEngine';
import { currentStreakLength } from '../store/gameStore';
import { decodeResult, decodeSeed, encodeResult, encodeSeed } from '../engine/UrlCodec';
import type { CompactResult, PlayerResult } from '../types/challenge';
import type { SessionComparison, TrackSession } from '../types/session';
import type { FieldId, Track } from '../types/track';

/** Challenge IDs used for client-only modes that have no server-side leaderboard. */
const CLIENT_ONLY_CHALLENGE_IDS = new Set(['daily-drop', 'solo-sprint', 'preview', 'micro']);

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
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 text-center" style={{ color: 'var(--color-fg-muted)' }}>
      <p className="text-lg" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em', color: 'var(--color-fg)' }}>Loading…</p>
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
  /** The session record for the just-completed track, used to build a micro-challenge link. */
  lastTrack: TrackSession;
  playerName: string;
  /** Length of the qualifying streak ending at `lastTrack`, used to preview the next track's bonus. */
  streakLength: number;
}

/** Banner previewing the streak bonus that will apply to the next track (DeepDive §A.8). */
function StreakBanner({ streakLength, isLastTrack }: { streakLength: number; isLastTrack: boolean }): JSX.Element | null {
  if (isLastTrack || streakLength < 2) return null;
  const bonusPct = Math.round(computeStreakBonus(streakLength) * 100);
  return (
    <div className="rounded-lg bg-amber-600/20 border border-amber-500 px-3 py-2 text-center text-sm font-semibold text-amber-300">
      🔥 {streakLength}-track streak — next track is worth +{bonusPct}%!
    </div>
  );
}

/** Single-track "challenge a friend" fast path, shown after any correct guess (DeepDive §B.7). */
function MicroChallengeToast({
  track,
  activeFields,
  scoreEarned,
  lastTrack,
  playerName,
}: {
  track: Track;
  activeFields: FieldId[];
  scoreEarned: number;
  lastTrack: TrackSession;
  playerName: string;
}): JSX.Element | null {
  const [copied, setCopied] = useState(false);

  if (lastTrack.fields_correct.length === 0) return null;

  const handleChallengeFriend = (): void => {
    const result: CompactResult = {
      u: playerName,
      s: Math.round(scoreEarned),
      g: [lastTrack.submit_count],
      t: Math.round(lastTrack.total_time_on_track_ms / 1000),
      p: lastTrack.fields_correct.length,
    };
    const url = `${window.location.origin}/?mode=micro&t=${encodeSeed(track.track_id)}&p=${activeFields.join(',')}&r=${encodeResult(result)}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    trackEvent('share_initiated', { channel: 'micro', mode: 'micro' });
  };

  return (
    <div className="rounded-xl p-4 text-center" style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}>
      <p className="mb-3 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
        ✅ You got &quot;{formatAnswer(track, 'song_title')}&quot;
        {lastTrack.first_guess_bonus_earned ? ' on the first clip!' : '!'}
      </p>
      <button
        type="button"
        onClick={handleChallengeFriend}
        className="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
        style={{ background: 'var(--color-spotlight)', color: 'var(--color-stage)', fontFamily: 'var(--font-display)' }}
      >
        {copied ? '✓ Link copied!' : '🔥 Challenge a friend →'}
      </button>
    </div>
  );
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
  lastTrack,
  playerName,
  streakLength,
}: RevealScreenProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4" style={{ color: 'var(--color-fg)' }}>
      <h1
        className="text-center text-2xl uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-fg-muted)' }}
      >
        Track {trackNumber} of {trackCount}
      </h1>
      <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-stage-card)', border: '1px solid var(--color-stage-border)' }}>
        <p className="mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--color-fg-muted)' }}>Score earned</p>
        <p className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-spotlight)' }}>
          {Math.round(scoreEarned).toLocaleString()}
        </p>
      </div>
      <StreakBanner streakLength={streakLength} isLastTrack={isLastTrack} />
      <MicroChallengeToast
        track={track}
        activeFields={activeFields}
        scoreEarned={scoreEarned}
        lastTrack={lastTrack}
        playerName={playerName}
      />
      <ul className="flex flex-col gap-2">
        {activeFields.map((fieldId) => {
          const correct = fieldsCorrect.includes(fieldId);
          return (
            <li
              key={fieldId}
              className="flex items-center justify-between rounded-xl px-4 py-2.5"
              style={{ background: 'var(--color-stage-card)', border: `1px solid ${correct ? 'var(--color-correct)' : 'var(--color-stage-border)'}` }}
            >
              <span className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>{FIELD_DEFINITIONS[fieldId].label}</span>
              <span style={{ color: correct ? 'var(--color-correct)' : 'var(--color-incorrect)' }}>
                {formatAnswer(track, fieldId)} {correct ? '✓' : '✗'}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onContinue}
        className="rounded-xl px-4 py-4 text-lg font-bold uppercase tracking-widest transition-opacity hover:opacity-90 active:scale-95"
        style={{ background: 'var(--color-spotlight)', color: 'var(--color-stage)', fontFamily: 'var(--font-display)' }}
        data-testid="continue-button"
      >
        {isLastTrack ? 'See Results' : 'Next Track →'}
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
  const unplayableTrackIds = useCatalogStore((state) => state.unplayableTrackIds);
  const playableTracks = useMemo(
    () => tracks.filter((track) => !unplayableTrackIds.has(track.track_id)),
    [tracks, unplayableTrackIds],
  );
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
  const assistMode = usePlayerStore((state) => state.assist_mode);
  const authUser = useAuthStore((state) => state.user);

  const trackStartRef = useRef<number | null>(null);
  const updatedAfterGameRef = useRef(false);
  // Tracks which `search` params the current `challenge` was built from, so a
  // new Solo Sprint / Daily Drop / micro-challenge link is loaded even though
  // `challenge` from a previous game is still sitting in the global store.
  const loadedSearchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tracks.length === 0) return;

    const searchKey = JSON.stringify([search.mode, search.seed, search.t, search.p, search.r]);
    if (loadedSearchKeyRef.current === searchKey) return;

    // No mode/seed specified: rely on a challenge pre-loaded externally
    // (e.g. accepted via /challenge/:id before navigating here).
    if (!search.mode && !search.seed && challenge) {
      loadedSearchKeyRef.current = searchKey;
      return;
    }

    if (search.mode === 'micro' && search.t && search.p) {
      const track = getTrack(decodeSeed(search.t));
      if (!track) return;
      const activeFields = search.p.split(',') as FieldId[];
      const challenger = search.r ? decodeResult(search.r) : null;
      loadedSearchKeyRef.current = searchKey;
      loadChallenge(
        buildMicroChallenge(track, activeFields, challenger?.u ?? 'a friend', challenger?.s ?? null),
        'micro',
        playerName,
      );
      return;
    }

    const seedIds = search.seed ? decodeSeed(search.seed).split(',').filter((id) => id.length > 0) : undefined;
    let selected: Track[];
    if (seedIds && seedIds.length > 0) {
      const seeded = seedIds.map((id) => getTrack(id)).filter((t): t is Track => t !== undefined);
      const playableSeeded = seeded.filter((t) => !unplayableTrackIds.has(t.track_id));
      // Prefer dropping seeded tracks with no working audio, but fall back to
      // the full seed (with ClipPlayer's "audio unavailable" state) rather
      // than getting stuck if every seeded track failed the check.
      selected = playableSeeded.length > 0 ? playableSeeded : seeded;
    } else {
      selected = playableTracks;
    }
    if (selected.length === 0) return;
    const mode = search.mode === 'daily' ? 'daily' : 'solo';
    loadedSearchKeyRef.current = searchKey;
    loadChallenge(buildSoloChallenge(selected, mode, playerId), mode, playerName);
  }, [
    tracks,
    playableTracks,
    unplayableTrackIds,
    challenge,
    search.seed,
    search.mode,
    search.t,
    search.p,
    search.r,
    getTrack,
    loadChallenge,
    playerId,
    playerName,
  ]);

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
    trackEvent('game_completed', {
      mode: session.mode,
      score: Math.round(session.totals.total_score),
      trackCount: session.tracks.length,
    });
    const unlockedBadges = updateAfterGame(session);
    if (unlockedBadges.length > 0) {
      useGameStore.setState((state) => ({ session: { ...state.session, unlocked_badges: unlockedBadges } }));
    }

    if (challenge?.id === 'micro' && search.r) {
      const challenger = decodeResult(search.r);
      if (challenger) {
        const margin = session.totals.total_score - challenger.s;
        const comparison: SessionComparison = {
          challenger_name: challenger.u,
          challenger_score: challenger.s,
          result: margin > 0 ? 'win' : margin < 0 ? 'loss' : 'tie',
          margin,
        };
        useGameStore.setState((state) => ({ session: { ...state.session, comparison } }));
      }
    } else if (challenge && challenge.id !== 'micro' && challenge.creator_score !== null) {
      // "Beat My Score" (async H2H, Phase 4 §4.1): the creator played first and
      // set a benchmark score for friends accepting the same challenge to beat.
      const creatorScore = challenge.creator_score;
      const margin = session.totals.total_score - creatorScore;
      const comparison: SessionComparison = {
        challenger_name: challenge.creator_name,
        challenger_score: creatorScore,
        result: margin > 0 ? 'win' : margin < 0 ? 'loss' : 'tie',
        margin,
      };
      useGameStore.setState((state) => ({ session: { ...state.session, comparison } }));
    }

    if (challenge && !CLIENT_ONLY_CHALLENGE_IDS.has(challenge.id)) {
      const clipExtensions = session.tracks.reduce(
        (sum, track) => sum + Math.max(0, track.clip_sequence_used.length - 1),
        0,
      );
      const result: PlayerResult = {
        playerId,
        playerName: session.player_name,
        score: session.totals.total_score,
        durationSeconds: session.duration_seconds,
        clipExtensions,
      };
      void fetch(`/api/challenge/${challenge.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }).catch(() => {});
    }

    // Submit to global leaderboard when user is signed in.
    if (authUser) {
      void fetch('/api/leaderboard/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: Math.round(session.totals.total_score) }),
      }).catch(() => {});
    }

    void navigate({ to: '/result' });
  }, [phase, session, updateAfterGame, navigate, challenge, playerId, search.r, authUser]);

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
        lastTrack={lastTrack}
        playerName={session.player_name}
        streakLength={currentStreakLength(session.tracks)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4" style={{ color: 'var(--color-fg)' }}>
      <h1
        className="text-center text-2xl uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-fg-muted)' }}
      >
        Track {currentTrackIndex + 1} of {trackCount}
      </h1>
      <ClipPlayer
        key={trackId}
        clipUrls={track.clip_urls}
        currentDuration={activeClipDuration}
        clipStartOffsetMs={track.clip_start_offset_ms}
        multiplier={speedMultiplier}
        onPlaybackStart={handlePlaybackStart}
        onPlaybackEnd={clipEnded}
        onExtendRequest={(): void => {}}
        fallbackSongTitle={track.answers.song_title.value ?? undefined}
        fallbackArtistName={track.answers.primary_artist.value ?? undefined}
        forceStop={phase === 'guessing'}
      />
      <div className="flex items-center gap-3">
        <SpeedMultiplierBadge multiplier={speedMultiplier} />
        <ClipExtendBar currentDuration={activeClipDuration} clipExtensions={clipExtensions} onExtend={extendClip} />
      </div>
      <GuessPanel
        track={track}
        activeFields={activeFields}
        fieldTries={fieldTries}
        assistMode={assistMode}
        onSubmit={(_results, guesses): void => submitGuess(guesses)}
        onGiveUp={skipTrack}
      />
    </div>
  );
}
