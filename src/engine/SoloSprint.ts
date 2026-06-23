import type { Track } from '../types/track';

/** Minimum number of tracks in a Solo Sprint (Phase 3 §3.6). */
export const MIN_SOLO_TRACKS = 3;

/** Maximum number of tracks in a Solo Sprint (Phase 3 §3.6). */
export const MAX_SOLO_TRACKS = 10;

/** Default Solo Sprint length when the player doesn't customize it. */
export const DEFAULT_SOLO_TRACKS = 5;

/** Genre/decade/artist filters applied to the catalog before random selection. */
export interface SoloSprintFilters {
  genres: string[];
  decades: number[];
  /** Case-insensitive substring match against `primary_artist`. */
  artist: string;
}

/** The 9 high-level genre groups shown on the home screen. */
export const HIGH_LEVEL_GENRES = [
  'Pop',
  'Rock',
  'Hip-Hop / Rap',
  'R&B / Soul',
  'Electronic / Dance',
  'Country',
  'Latin',
  'Classical',
  'Jazz & Blues',
] as const;

export type HighLevelGenre = (typeof HIGH_LEVEL_GENRES)[number];

/**
 * Returns the fixed list of 9 high-level genre groups, filtered to those that
 * have at least one track in the catalog so empty buttons never appear.
 */
export function listGenres(tracks: Track[]): string[] {
  const present = new Set(tracks.map((t) => t.metadata.genre_group).filter(Boolean));
  return HIGH_LEVEL_GENRES.filter((g) => present.has(g));
}

/** All distinct decades present in the catalog, sorted ascending. */
export function listDecades(tracks: Track[]): number[] {
  const decades = new Set<number>();
  for (const track of tracks) decades.add(track.metadata.decade);
  return [...decades].sort((a, b) => a - b);
}

/** Filters the catalog down to tracks matching the given genre/decade/artist filters. */
export function filterTracksForSoloSprint(tracks: Track[], filters: SoloSprintFilters): Track[] {
  return tracks.filter((track) => {
    if (filters.genres.length > 0) {
      // Match against the high-level genre_group field so the 9 home-screen
      // buttons always work regardless of how many fine-grained tags a track has.
      const group = track.metadata.genre_group ?? '';
      if (!filters.genres.includes(group)) return false;
    }
    if (filters.decades.length > 0 && !filters.decades.includes(track.metadata.decade)) {
      return false;
    }
    if (filters.artist.trim().length > 0) {
      const artist = track.answers.primary_artist.value?.toLowerCase() ?? '';
      if (!artist.includes(filters.artist.trim().toLowerCase())) return false;
    }
    return true;
  });
}

/** Returns up to `count` tracks chosen at random from `tracks` (Fisher-Yates shuffle). */
export function pickRandomTracks(tracks: Track[], count: number, random: () => number = Math.random): Track[] {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Picks `count` tracks at random, strongly preferring tracks the player
 * hasn't heard recently. Tracks NOT in `recentIds` are shuffled into the
 * front of the pool; recently-played tracks are shuffled into the back and
 * only drawn if there aren't enough fresh ones.
 */
export function pickFreshTracks(
  tracks: Track[],
  recentIds: string[],
  count: number,
  random: () => number = Math.random,
): Track[] {
  const recentSet = new Set(recentIds);
  const fresh = tracks.filter((t) => !recentSet.has(t.track_id));
  const recent = tracks.filter((t) => recentSet.has(t.track_id));

  const shuffledFresh = pickRandomTracks(fresh, fresh.length, random);
  const shuffledRecent = pickRandomTracks(recent, recent.length, random);
  const ordered = [...shuffledFresh, ...shuffledRecent];
  return ordered.slice(0, Math.min(count, ordered.length));
}

/** Builds the comma-separated `seed` URL param from a list of tracks. */
export function buildSoloSprintSeed(tracks: Track[]): string {
  return tracks.map((track) => track.track_id).join(',');
}
