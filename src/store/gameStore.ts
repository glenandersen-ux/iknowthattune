import { create } from 'zustand';
import { useCatalogStore } from './catalogStore';
import { trackEvent } from '../engine/Analytics';
import { evaluateFieldGuess } from '../engine/FieldMatching';
import {
  FIELD_DEFINITIONS,
  computeClipExtensionPenalty,
  computeFieldScore,
  computeFirstGuessBonus,
  computeSpeedMultiplier,
  computeStreakBonus,
} from '../engine/ScoringEngine';
import type { Challenge } from '../types/challenge';
import type { ClipDuration, FieldId } from '../types/track';
import type {
  FieldGuess,
  FieldResultStatus,
  GamePhase,
  GuessHistoryEntry,
  PlayerSession,
  SessionTotals,
  TrackSession,
} from '../types/session';

const CLIP_DURATIONS: ClipDuration[] = ['1s', '3s', '5s', '10s', '30s'];

/** Builds a fresh, empty session shell for a new game. */
function createEmptySession(mode: PlayerSession['mode'], playerName: string): PlayerSession {
  return {
    session_id: crypto.randomUUID(),
    player_name: playerName,
    challenge_id: null,
    mode,
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_seconds: 0,
    device_type: 'desktop',
    tracks: [],
    totals: {
      total_score: 0,
      tracks_completed: 0,
      tracks_perfect: 0,
      tracks_skipped: 0,
      total_params_attempted: 0,
      total_params_correct: 0,
      total_params_incorrect: 0,
      accuracy_pct: 0,
      first_guess_bonuses_earned: 0,
      max_streak: 0,
      clips_extended: 0,
      total_clip_penalty: 0,
    },
    comparison: null,
    share: null,
  };
}

/**
 * A track "qualifies" for the streak bonus if it was answered fully correct,
 * with zero clip extensions, and the player did not give up (DeepDive §A.8).
 */
function trackQualifiesForStreak(track: TrackSession): boolean {
  return !track.gave_up && track.fields_incorrect.length === 0 && track.clip_penalty_applied === 0;
}

/** Length of the consecutive qualifying-track streak ending at the last entry of `tracks`. */
export function currentStreakLength(tracks: TrackSession[]): number {
  let streak = 0;
  for (let i = tracks.length - 1; i >= 0; i -= 1) {
    if (!trackQualifiesForStreak(tracks[i])) break;
    streak += 1;
  }
  return streak;
}

/** Recomputes session-wide aggregate stats from the per-track history (Blueprint §11). */
export function recomputeTotals(tracks: TrackSession[]): SessionTotals {
  let totalScore = 0;
  let tracksPerfect = 0;
  let tracksSkipped = 0;
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;
  let firstGuessBonuses = 0;
  let clipsExtended = 0;
  let totalClipPenalty = 0;
  let runningStreak = 0;
  let maxStreak = 0;

  for (const track of tracks) {
    totalScore += Math.max(0, track.raw_score + track.clip_penalty_applied);
    if (track.gave_up) tracksSkipped += 1;
    if (trackQualifiesForStreak(track)) {
      tracksPerfect += 1;
      runningStreak += 1;
      maxStreak = Math.max(maxStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
    attempted += track.fields_attempted.length;
    correct += track.fields_correct.length;
    incorrect += track.fields_incorrect.length;
    if (track.first_guess_bonus_earned) firstGuessBonuses += 1;
    clipsExtended += Math.max(0, track.clip_sequence_used.length - 1);
    totalClipPenalty += track.clip_penalty_applied;
  }

  return {
    total_score: totalScore,
    tracks_completed: tracks.filter((t) => !t.gave_up).length,
    tracks_perfect: tracksPerfect,
    tracks_skipped: tracksSkipped,
    total_params_attempted: attempted,
    total_params_correct: correct,
    total_params_incorrect: incorrect,
    accuracy_pct: attempted > 0 ? (correct / attempted) * 100 : 0,
    first_guess_bonuses_earned: firstGuessBonuses,
    max_streak: maxStreak,
    clips_extended: clipsExtended,
    total_clip_penalty: totalClipPenalty,
  };
}

/** Active session state for a single playthrough (TechStack §D.4). */
export interface GameStore {
  /** Challenge config (loaded from URL or KV). */
  challenge: Challenge | null;

  /** Active game state. */
  currentTrackIndex: number;
  phase: GamePhase;

  /** Per-track runtime state. */
  activeClipDuration: ClipDuration;
  timeElapsedMs: number;
  /** Recomputed every 100ms by the game screen via `ScoringEngine.computeSpeedMultiplier`. */
  speedMultiplier: number;
  clipExtensions: number;

  /** Session accumulator (Blueprint §11). */
  session: PlayerSession;

  /** Loads a challenge and resets all per-game state for a new playthrough. */
  loadChallenge: (challenge: Challenge, mode: PlayerSession['mode'], playerName: string) => void;
  /** Begins playback of the current track's clip and resets per-track timers. */
  startTrack: () => void;
  /** Updates the live elapsed-time clock and speed multiplier (driven by `AudioContext.currentTime`). */
  tick: (elapsedMs: number) => void;
  /** Marks the clip as finished playing; the player may still extend or submit. */
  clipEnded: () => void;
  /** Returns to the "playing" phase without resetting timers (used when a "Hear More" extension replays the clip). */
  resumePlaying: () => void;
  /** Submits the player's guesses for the active track's unlocked fields. */
  submitGuess: (fields: FieldGuess[]) => void;
  /** Extends the current clip to the next duration tier, applying its penalty. */
  extendClip: () => void;
  /** Skips the current track, scoring it as zero. */
  skipTrack: () => void;
  /** Moves to the next track, or completes the game if none remain. */
  advanceTrack: () => void;
  /** Marks the session as finished and stamps `completed_at`. */
  completeGame: () => void;
  /** Resets the store to its initial state. */
  reset: () => void;
}

const initialRuntimeState = {
  challenge: null as Challenge | null,
  currentTrackIndex: 0,
  phase: 'idle' as GamePhase,
  activeClipDuration: '1s' as ClipDuration,
  timeElapsedMs: 0,
  speedMultiplier: 2.0,
  clipExtensions: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialRuntimeState,
  session: createEmptySession('solo', 'Player'),

  loadChallenge: (challenge, mode, playerName) => {
    set({
      ...initialRuntimeState,
      challenge,
      session: {
        ...createEmptySession(mode, playerName),
        challenge_id: challenge.id,
      },
    });
    trackEvent('game_started', { mode, challengeId: challenge.id });
  },

  startTrack: () => {
    set({
      phase: 'playing',
      activeClipDuration: '1s',
      timeElapsedMs: 0,
      speedMultiplier: 2.0,
      clipExtensions: 0,
    });
  },

  tick: (elapsedMs) => {
    set({ timeElapsedMs: elapsedMs, speedMultiplier: computeSpeedMultiplier(elapsedMs / 1000) });
  },

  clipEnded: () => {
    if (get().phase === 'playing') {
      set({ phase: 'guessing' });
    }
  },

  resumePlaying: () => {
    if (get().phase === 'guessing') {
      set({ phase: 'playing' });
    }
  },

  submitGuess: (fields) => {
    const { challenge, currentTrackIndex, session, activeClipDuration, clipExtensions, timeElapsedMs } = get();
    if (!challenge) return;

    const trackId = challenge.tracks[currentTrackIndex];
    const track = useCatalogStore.getState().getTrack(trackId);
    if (!track) return;

    const activeFields = challenge.active_params[trackId] ?? [];
    const fieldScores: number[] = [];
    const fieldsCorrect: FieldId[] = [];
    const fieldsIncorrect: FieldId[] = [];
    const results: Partial<Record<FieldId, FieldResultStatus>> = {};
    const guesses: Partial<Record<FieldId, FieldGuess['value']>> = {};

    for (const { fieldId, value } of fields) {
      guesses[fieldId] = value;
      const inputType = FIELD_DEFINITIONS[fieldId].inputType;
      const match = evaluateFieldGuess(inputType, value, track.answers[fieldId]);
      const partialRatio = match.correct ? 1 : match.partial;
      fieldScores.push(computeFieldScore(fieldId, partialRatio > 0, timeElapsedMs, clipExtensions, partialRatio));

      if (match.correct) {
        fieldsCorrect.push(fieldId);
        results[fieldId] = 'correct';
      } else if (match.partial > 0) {
        fieldsIncorrect.push(fieldId);
        results[fieldId] = 'partial';
      } else {
        fieldsIncorrect.push(fieldId);
        results[fieldId] = 'incorrect';
      }

      trackEvent('guess_submitted', { correct: match.correct, fieldId, clipDuration: activeClipDuration });
    }

    const allCorrect = activeFields.length > 0 && activeFields.every((id) => fieldsCorrect.includes(id));
    const elapsedSeconds = timeElapsedMs / 1000;
    const firstGuessBonus = computeFirstGuessBonus(
      allCorrect,
      clipExtensions,
      elapsedSeconds,
      challenge.scoring.first_guess_bonus,
    );
    const clipPenalty = computeClipExtensionPenalty(clipExtensions, 1, challenge.scoring.clip_penalties);
    const streakBonus = computeStreakBonus(currentStreakLength(session.tracks));
    const rawScore = (fieldScores.reduce((sum, score) => sum + score, 0) + firstGuessBonus) * (1 + streakBonus);

    const guessHistoryEntry: GuessHistoryEntry = {
      submit_index: 1,
      clip_at_submission: activeClipDuration,
      time_ms: timeElapsedMs,
      guesses,
      results,
    };

    const trackSession: TrackSession = {
      track_id: trackId,
      play_order: currentTrackIndex + 1,
      clip_sequence_used: CLIP_DURATIONS.slice(0, clipExtensions + 1),
      time_to_first_submit_ms: timeElapsedMs,
      total_time_on_track_ms: timeElapsedMs,
      submit_count: 1,
      fields_attempted: activeFields,
      fields_correct: fieldsCorrect,
      fields_incorrect: fieldsIncorrect,
      fields_skipped: [],
      first_guess_bonus_earned: firstGuessBonus > 0,
      streak_position: currentStreakLength(session.tracks),
      raw_score: rawScore,
      clip_penalty_applied: clipPenalty === 0 ? 0 : -clipPenalty,
      speed_multiplier_applied: computeSpeedMultiplier(elapsedSeconds),
      guess_history: [guessHistoryEntry],
    };

    const tracks = [...session.tracks, trackSession];
    set({
      phase: 'reveal',
      session: { ...session, tracks, totals: recomputeTotals(tracks) },
    });
  },

  extendClip: () => {
    const { activeClipDuration, currentTrackIndex } = get();
    const nextIndex = CLIP_DURATIONS.indexOf(activeClipDuration) + 1;
    if (nextIndex >= CLIP_DURATIONS.length) return;
    const nextDuration = CLIP_DURATIONS[nextIndex];
    set({
      activeClipDuration: nextDuration,
      clipExtensions: get().clipExtensions + 1,
    });
    trackEvent('clip_extended', { from: activeClipDuration, to: nextDuration, trackIndex: currentTrackIndex });
  },

  skipTrack: () => {
    const { challenge, currentTrackIndex, session, clipExtensions, timeElapsedMs } = get();
    if (!challenge) return;

    const trackId = challenge.tracks[currentTrackIndex];
    const activeFields = challenge.active_params[trackId] ?? [];

    const trackSession: TrackSession = {
      track_id: trackId,
      play_order: currentTrackIndex + 1,
      clip_sequence_used: CLIP_DURATIONS.slice(0, clipExtensions + 1),
      time_to_first_submit_ms: timeElapsedMs,
      total_time_on_track_ms: timeElapsedMs,
      submit_count: 0,
      fields_attempted: activeFields,
      fields_correct: [],
      fields_incorrect: [],
      fields_skipped: activeFields,
      first_guess_bonus_earned: false,
      streak_position: currentStreakLength(session.tracks),
      raw_score: 0,
      clip_penalty_applied: 0,
      speed_multiplier_applied: computeSpeedMultiplier(timeElapsedMs / 1000),
      guess_history: [],
      gave_up: true,
    };

    const tracks = [...session.tracks, trackSession];
    set({
      phase: 'reveal',
      session: { ...session, tracks, totals: recomputeTotals(tracks) },
    });
  },

  advanceTrack: () => {
    const { challenge, currentTrackIndex } = get();
    const trackCount = challenge?.tracks.length ?? 0;
    if (currentTrackIndex + 1 >= trackCount) {
      get().completeGame();
      return;
    }
    set({
      currentTrackIndex: currentTrackIndex + 1,
      phase: 'idle',
      activeClipDuration: '1s',
      timeElapsedMs: 0,
      speedMultiplier: 2.0,
      clipExtensions: 0,
    });
  },

  completeGame: () => {
    set((state) => ({
      phase: 'complete',
      session: {
        ...state.session,
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - new Date(state.session.started_at).getTime()) / 1000),
      },
    }));
  },

  reset: () => {
    set({
      ...initialRuntimeState,
      session: createEmptySession('solo', 'Player'),
    });
  },
}));
