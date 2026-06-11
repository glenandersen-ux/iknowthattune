import { create } from 'zustand';
import type { Challenge } from '../types/challenge';
import type { ClipDuration } from '../types/track';
import type { FieldGuess, GamePhase, PlayerSession } from '../types/session';

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

  submitGuess: (_fields) => {
    set({ phase: 'reveal' });
  },

  extendClip: () => {
    const durations: ClipDuration[] = ['1s', '3s', '5s', '10s', '30s'];
    const { activeClipDuration } = get();
    const nextIndex = durations.indexOf(activeClipDuration) + 1;
    if (nextIndex >= durations.length) return;
    set({
      activeClipDuration: durations[nextIndex],
      clipExtensions: get().clipExtensions + 1,
    });
  },

  skipTrack: () => {
    set({ phase: 'reveal' });
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
