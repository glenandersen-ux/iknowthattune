import type { ClipDuration, FieldId } from './track';

/** Top-level game state machine (Blueprint §6 Guess Loop). */
export type GamePhase = 'idle' | 'playing' | 'guessing' | 'reveal' | 'complete';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type GameMode = 'daily' | 'solo' | 'challenge' | 'h2h' | 'niche' | 'micro';

/** Outcome of a single field within one guess submission. */
export type FieldResultStatus = 'correct' | 'incorrect' | 'partial';

/** A value the player submitted for a field; shape depends on `FieldInputType`. */
export type FieldGuessValue = string | number | string[];

/** A single field's submitted value, passed to `GameStore.submitGuess`. */
export interface FieldGuess {
  fieldId: FieldId;
  value: FieldGuessValue;
  /** Set when the player used a hint on this field — score is halved, no speed bonus. */
  hintUsed?: 'letter';
}

/** One submission event within a track's guess history. */
export interface GuessHistoryEntry {
  /** 1-based index of this submission within the track. */
  submit_index: number;
  clip_at_submission: ClipDuration;
  /** Milliseconds since the track's clip started playing. */
  time_ms: number;
  guesses: Partial<Record<FieldId, FieldGuessValue>>;
  results: Partial<Record<FieldId, FieldResultStatus>>;
}

/** Per-track outcome recorded in a player's session (Blueprint §11). */
export interface TrackSession {
  track_id: string;
  /** 1-based position in the challenge's track order. */
  play_order: number;
  /** Ordered list of clip durations played, reflecting "Hear More" extensions. */
  clip_sequence_used: ClipDuration[];
  time_to_first_submit_ms: number;
  total_time_on_track_ms: number;
  submit_count: number;
  fields_attempted: FieldId[];
  fields_correct: FieldId[];
  fields_incorrect: FieldId[];
  fields_skipped: FieldId[];
  /** True only if all conditions in DeepDive §A.6 were met. */
  first_guess_bonus_earned: boolean;
  /** Streak length entering this track (0 if no streak bonus applied). */
  streak_position: number;
  raw_score: number;
  /** Negative or zero; total points deducted for clip extensions on this track. */
  clip_penalty_applied: number;
  /** Speed multiplier applied at the moment of the scoring submission. */
  speed_multiplier_applied: number;
  guess_history: GuessHistoryEntry[];
  /** True if the player pressed "Give Up" on this track (DeepDive §A.9). */
  gave_up?: boolean;
}

/** Aggregate stats across all tracks in a session (Blueprint §11). */
export interface SessionTotals {
  total_score: number;
  tracks_completed: number;
  tracks_perfect: number;
  tracks_skipped: number;
  total_params_attempted: number;
  total_params_correct: number;
  total_params_incorrect: number;
  accuracy_pct: number;
  first_guess_bonuses_earned: number;
  max_streak: number;
  clips_extended: number;
  /** Negative or zero; sum of all clip extension penalties across the session. */
  total_clip_penalty: number;
}

/** Comparison against the challenge creator's benchmark score. */
export interface SessionComparison {
  challenger_name: string;
  challenger_score: number;
  result: 'win' | 'loss' | 'tie';
  /** Positive if the player won, negative if they lost. */
  margin: number;
}

/** Tracking for the post-game share action. */
export interface SessionShare {
  result_url: string;
  result_grid_text: string;
  shared: boolean;
  shared_at: string | null;
  share_channel: string | null;
}

/** The full per-game session object (Blueprint §11). */
export interface PlayerSession {
  session_id: string;
  player_name: string;
  challenge_id: string | null;
  mode: GameMode;
  /** ISO 8601 timestamp. */
  started_at: string;
  /** ISO 8601 timestamp, or null while the game is in progress. */
  completed_at: string | null;
  duration_seconds: number;
  device_type: DeviceType;
  tracks: TrackSession[];
  totals: SessionTotals;
  comparison: SessionComparison | null;
  share: SessionShare | null;
  /** Badges newly unlocked by this session, set client-side after `playerStore.updateAfterGame`. */
  unlocked_badges?: BadgeId[];
  /**
   * True if this is a repeat playthrough of a challenge already submitted to
   * the leaderboard (Blueprint §12) — excluded from leaderboard ranking.
   */
  replay?: boolean;
}

/** Badge identifiers unlockable via `BadgeEngine` (DeepDive Phase 3 / Blueprint §13). */
export type BadgeId =
  | 'first_blood'
  | 'lightning_round'
  | 'encyclopedia'
  | 'on_fire'
  | 'stump_master'
  | 'band_nerd'
  | 'sample_detective'
  | 'year_wizard';

/** Lifetime player profile persisted to localStorage (Blueprint §11). */
export interface PlayerProfile {
  /** Generated once on first visit, stored in localStorage. */
  player_id: string;
  display_name: string;
  /** ISO 8601 date string. */
  created_at: string;
  games_played: number;
  games_created: number;
  challenges_shared: number;
  challenges_received: number;
  total_score_all_time: number;
  avg_score_per_game: number;
  best_score_ever: number;
  perfect_tracks: number;
  accuracy_all_time_pct: number;
  favorite_genres: string[];
  /** Per-field accuracy ratio (0-1) among the player's worst fields. */
  hardest_field_accuracy: Partial<Record<FieldId, number>>;
  /** Per-field accuracy ratio (0-1) among the player's best fields. */
  easiest_field_accuracy: Partial<Record<FieldId, number>>;
  badges: BadgeId[];
  /** Challenge IDs where this player's score beat the creator's benchmark. */
  challenges_beaten: string[];
  /** Consecutive days the Daily Drop has been completed. */
  daily_drop_streak: number;
  /** ISO 8601 date (YYYY-MM-DD) the Daily Drop streak was last incremented, or null if never played. */
  daily_drop_streak_date: string | null;
  /** Score earned in the most recent completed Daily Drop. */
  daily_drop_last_score: number | null;
  /** Track IDs where every `band_members` entry has ever been guessed correctly (Band Nerd badge). */
  bands_correctly_named: string[];
  /** Lifetime count of correctly-guessed `sample_source` fields (Sample Detective badge). */
  sample_sources_correct: number;
  /** Lifetime count of `release_year` guesses correct and within ±1 of the canonical year (Year Wizard badge). */
  years_within_one: number;
  /** Lifetime per-field attempt/correct counts, used to derive `hardest_field_accuracy` / `easiest_field_accuracy`. */
  field_stats: Partial<Record<FieldId, { attempted: number; correct: number }>>;
  /**
   * Player-controlled assist level: `'regular'` shows autocomplete suggestions
   * for text fields (song title, artist, album, etc.); `'expert'` hides all
   * suggestions and requires the player to type every answer unaided.
   */
  assist_mode: 'regular' | 'expert';
  /**
   * Rolling list of the most recently played track IDs (newest first, capped at 20).
   * Used by Solo Sprint to prefer tracks the player hasn't heard recently.
   */
  recently_played_track_ids: string[];
}
