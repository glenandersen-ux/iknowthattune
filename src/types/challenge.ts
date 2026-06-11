import type { ClipStart, FieldId } from './track';

/** Speed-decay and penalty regime for a challenge (DeepDive §B.5). */
export type TimePressure = 'standard' | 'blitz' | 'chill';

/** How much of a field's category is revealed before guessing. */
export type HintsMode = 'none' | 'category' | 'generous';

/** Per-challenge rules configured by the creator (Blueprint §5, DeepDive §B.5). */
export interface ChallengeSettings {
  time_pressure: TimePressure;
  hints: HintsMode;
  /** Milliseconds after `created_at` the challenge stops accepting new results, or null for never. */
  expiry_ms: number | null;
  leaderboard_public: boolean;
}

/** Scoring constants baked into the challenge so all players are scored identically. */
export interface ChallengeScoring {
  first_guess_bonus: number;
  /** Cumulative point cost per clip extension step: [1s->3s, 3s->5s, 5s->10s, 10s->30s]. */
  clip_penalties: number[];
  /** Multiplier applied to the next track's score per consecutive qualifying streak. */
  streak_multipliers: number[];
}

/** The full challenge object (Blueprint §5, TechStack §D.9). */
export interface Challenge {
  id: string;
  /** Schema version for forward migration. */
  version: number;
  created_at: number;
  creator_name: string;
  /** localStorage-generated UUID identifying the creator across sessions. */
  creator_player_id: string;
  /** null if the creator skipped self-play before publishing. */
  creator_score: number | null;
  name: string | null;
  /** Ordered track IDs; this order is fixed for all recipients. */
  tracks: string[];
  /** Active guessable fields per track ID. */
  active_params: Record<string, FieldId[]>;
  /** Clip start strategy per track ID. */
  clip_starts: Record<string, ClipStart>;
  settings: ChallengeSettings;
  scoring: ChallengeScoring;
  /** R2 object keys for BYOC clips, keyed by upload slot (TechStack §D.7, Phase 4 §4.2). */
  byoc_clips?: Record<string, string>;
}

/** A single leaderboard entry submitted to the per-challenge Durable Object. */
export interface PlayerResult {
  playerId: string;
  playerName: string;
  score: number;
  durationSeconds: number;
  clipExtensions: number;
  rank?: number;
}

/** Compact result payload encoded into the `r` URL param (Blueprint §5). */
export interface CompactResult {
  /** Player name, truncated to 20 chars. */
  u: string;
  /** Total score. */
  s: number;
  /** Guess attempts per track (0 = skipped). */
  g: number[];
  /** Total time taken, in seconds. */
  t: number;
  /** Total correct params across the session. */
  p: number;
}

/** Request body for `POST /api/challenge`. */
export interface CreateChallengeRequest {
  creator_name: string;
  creator_player_id: string;
  creator_score: number | null;
  name: string | null;
  tracks: string[];
  active_params: Record<string, FieldId[]>;
  clip_starts: Record<string, ClipStart>;
  settings: ChallengeSettings;
  scoring: ChallengeScoring;
}
