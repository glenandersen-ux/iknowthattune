import type { Track } from '../types/track';

/** Today's date as `YYYY-MM-DD` in the local timezone. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministically picks today's Daily Drop track from the catalog.
 * The same `date` always maps to the same track, matching the
 * `daily:YYYY-MM-DD` KV lookup performed by `workers/api/daily.ts` in production.
 */
export function getDailyTrackId(tracks: Track[], date: string): string | null {
  if (tracks.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < date.length; i += 1) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  return tracks[hash % tracks.length].track_id;
}

/** Difficulty badge tier from a track's `metadata.difficulty_score` (Blueprint §4). */
export function difficultyLabel(score: number): 'Easy' | 'Medium' | 'Hard' {
  if (score <= 1.5) return 'Easy';
  if (score <= 2.5) return 'Medium';
  return 'Hard';
}
