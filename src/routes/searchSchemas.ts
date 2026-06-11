import { z } from 'zod';

/** Game mode selector shared across the home and game routes (Blueprint §2). */
export const gameModeSchema = z.enum(['daily', 'solo', 'h2h', 'niche', 'micro']);

/**
 * Search params accepted by `/` and `/game` (Blueprint §5 URL Parameter Reference).
 * All fields are optional — the combination present determines which mode loads.
 */
export const gameSearchSchema = z.object({
  mode: gameModeSchema.optional(),
  /** Daily Drop date, YYYY-MM-DD. */
  date: z.string().optional(),
  /** Comma-separated track IDs for Solo Sprint. */
  seed: z.string().optional(),
  /** Stump Your Friends challenge ID. */
  c: z.string().optional(),
  /** Challenge schema version. */
  v: z.coerce.number().optional(),
  /** Base64 result payload for score comparison. */
  r: z.string().optional(),
  /** Niche category slug. */
  cat: z.string().optional(),
  /** Head-to-head room code. */
  room: z.string().optional(),
  /** Micro-challenge track ID. */
  t: z.string().optional(),
  /** Comma-separated active param field IDs for a micro-challenge. */
  p: z.string().optional(),
  /** Set when the player has accepted a challenge and is ready to play. */
  play: z.coerce.boolean().optional(),
  /** Set to view a challenge's leaderboard instead of playing. */
  view: z.enum(['leaderboard']).optional(),
  /** Base64-encoded full challenge object for ≤2-track URL-embedded challenges. */
  mini: z.string().optional(),
});

export type GameSearch = z.infer<typeof gameSearchSchema>;

/** Search params for `/result` — the player's session must be passed via router state. */
export const resultSearchSchema = z.object({
  c: z.string().optional(),
  r: z.string().optional(),
});

export type ResultSearch = z.infer<typeof resultSearchSchema>;

/** Search params for `/leaderboard`. */
export const leaderboardSearchSchema = z.object({
  c: z.string(),
});

export type LeaderboardSearch = z.infer<typeof leaderboardSearchSchema>;
