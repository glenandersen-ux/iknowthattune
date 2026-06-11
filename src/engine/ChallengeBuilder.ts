import { CUMULATIVE_CLIP_PENALTIES, FIRST_GUESS_BONUS } from './ScoringEngine';
import type { Challenge, ChallengeScoring } from '../types/challenge';
import type { ClipStart, FieldId, Track } from '../types/track';

/** Tier 1 fields guessed by default in solo/daily challenges built client-side (Phase 1). */
export const DEFAULT_ACTIVE_FIELDS: FieldId[] = [
  'song_title',
  'primary_artist',
  'release_year',
  'album_name',
];

/** Per-track streak multipliers, indexed by streak length 1-4+ (DeepDive §A.8). */
const STREAK_MULTIPLIERS = [0.1, 0.2, 0.35, 0.5];

/** Default scoring config matching the constants baked into `ScoringEngine`. */
export const DEFAULT_CHALLENGE_SCORING: ChallengeScoring = {
  first_guess_bonus: FIRST_GUESS_BONUS,
  clip_penalties: [...CUMULATIVE_CLIP_PENALTIES],
  streak_multipliers: STREAK_MULTIPLIERS,
};

/**
 * Builds an ad-hoc client-side `Challenge` for Daily Drop / Solo Sprint modes
 * (Phase 1), where every track uses the Tier 1 field set, the "hook" clip
 * start, and the default scoring config — no server round trip required.
 */
export function buildSoloChallenge(
  tracks: Track[],
  mode: 'daily' | 'solo',
  playerId: string,
): Challenge {
  const activeParams: Record<string, FieldId[]> = {};
  const clipStarts: Record<string, ClipStart> = {};
  for (const track of tracks) {
    activeParams[track.track_id] = DEFAULT_ACTIVE_FIELDS;
    clipStarts[track.track_id] = 'hook';
  }

  return {
    id: mode === 'daily' ? 'daily-drop' : 'solo-sprint',
    version: 1,
    created_at: Date.now(),
    creator_name: 'Player',
    creator_player_id: playerId,
    creator_score: null,
    name: mode === 'daily' ? "Today's Drop" : 'Solo Sprint',
    tracks: tracks.map((track) => track.track_id),
    active_params: activeParams,
    clip_starts: clipStarts,
    settings: {
      time_pressure: 'standard',
      hints: 'none',
      expiry_ms: null,
      leaderboard_public: true,
    },
    scoring: DEFAULT_CHALLENGE_SCORING,
  };
}

/**
 * Builds a single-track "micro-challenge" (DeepDive §B.7) from a `/?mode=micro`
 * URL — the lowest-friction viral loop, generated instantly after a correct guess.
 */
export function buildMicroChallenge(
  track: Track,
  activeFields: FieldId[],
  challengerName: string,
  challengerScore: number | null,
): Challenge {
  return {
    id: 'micro',
    version: 1,
    created_at: Date.now(),
    creator_name: challengerName,
    creator_player_id: '',
    creator_score: challengerScore,
    name: 'Single-Track Challenge',
    tracks: [track.track_id],
    active_params: { [track.track_id]: activeFields },
    clip_starts: { [track.track_id]: 'hook' },
    settings: {
      time_pressure: 'standard',
      hints: 'none',
      expiry_ms: null,
      leaderboard_public: false,
    },
    scoring: DEFAULT_CHALLENGE_SCORING,
  };
}
