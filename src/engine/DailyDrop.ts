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
  // Prefer tracks confirmed to have Deezer audio so the fallback drop
  // is actually playable. Falls back to the full catalog if none are confirmed.
  const pool = tracks.filter((t) => t.metadata.deezer_track_id);
  const source = pool.length > 0 ? pool : tracks;
  let hash = 0;
  for (let i = 0; i < date.length; i += 1) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  return source[hash % source.length].track_id;
}

/**
 * Looks up an editorially-curated Daily Drop override for `date` from
 * `GET /api/daily`, which reads the `daily:YYYY-MM-DD` KV key written by
 * `workers/api/daily.ts`. Returns `null` if no override is set or the
 * request fails, so callers fall back to {@link getDailyTrackId}.
 */
export async function fetchDailyTrackOverride(date: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/daily?date=${encodeURIComponent(date)}`);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) return null;
    const trackId = (data as { trackId?: unknown }).trackId;
    return typeof trackId === 'string' ? trackId : null;
  } catch {
    return null;
  }
}

/** Difficulty badge tier from a track's `metadata.difficulty_score` (Blueprint §4). */
export function difficultyLabel(score: number): 'Easy' | 'Medium' | 'Hard' {
  if (score <= 1.5) return 'Easy';
  if (score <= 2.5) return 'Medium';
  return 'Hard';
}
