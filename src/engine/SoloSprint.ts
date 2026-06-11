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

/** All distinct genres present in the catalog, sorted alphabetically. */
export function listGenres(tracks: Track[]): string[] {
  const genres = new Set<string>();
  for (const track of tracks) {
    const value = track.answers.genre.value;
    const list = Array.isArray(value) ? value : value ? [value] : [];
    for (const genre of list) genres.add(genre);
  }
  return [...genres].sort();
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
      const value = track.answers.genre.value;
      const trackGenres = Array.isArray(value) ? value : value ? [value] : [];
      if (!filters.genres.some((genre) => trackGenres.includes(genre))) return false;
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

/** Builds the comma-separated `seed` URL param from a list of tracks. */
export function buildSoloSprintSeed(tracks: Track[]): string {
  return tracks.map((track) => track.track_id).join(',');
}
