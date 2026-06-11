import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Fuse from 'fuse.js';
import type { FieldId, FilterSet, Track } from '../types/track';

const CATALOG_URL = '/catalog/data/seed-tracks.json';

const FUSE_OPTIONS: ConstructorParameters<typeof Fuse<Track>>[1] = {
  keys: [
    'answers.song_title.value',
    'answers.song_title.aliases',
    'answers.primary_artist.value',
    'answers.primary_artist.aliases',
    'answers.album_name.value',
  ],
  threshold: 0.3,
};

/** Search and browse state for the catalog (TechStack §D.4, §D.6). */
export interface CatalogStore {
  /** Loaded from R2 JSON (or local seed data in dev). */
  tracks: Track[];
  fuseIndex: Fuse<Track> | null;
  /** Per-field autocomplete lists, derived from `tracks` after load. */
  fieldTries: Partial<Record<FieldId, string[]>>;
  isLoading: boolean;

  loadCatalog: () => Promise<void>;
  search: (query: string, filters: FilterSet) => Track[];
  getTrack: (id: string) => Track | undefined;
}

function matchesFilters(track: Track, filters: FilterSet): boolean {
  if (filters.decade && !filters.decade.includes(track.metadata.decade)) {
    return false;
  }
  if (filters.language && !filters.language.includes(track.metadata.language)) {
    return false;
  }
  if (filters.hasNicheTrivia !== undefined) {
    const hasNiche =
      track.answers.sample_source.value !== null ||
      track.answers.covered_by.value.length > 0 ||
      track.metadata.curator_note !== undefined;
    if (hasNiche !== filters.hasNicheTrivia) return false;
  }
  if (filters.genre && filters.genre.length > 0) {
    const trackGenres = track.answers.genre.value;
    const genreList = Array.isArray(trackGenres) ? trackGenres : trackGenres ? [trackGenres] : [];
    if (!filters.genre.some((g) => genreList.includes(g))) return false;
  }
  if (filters.difficulty && filters.difficulty.length > 0) {
    const tier =
      track.metadata.difficulty_score <= 1.5
        ? 1
        : track.metadata.difficulty_score <= 2.5
          ? 2
          : 3;
    if (!filters.difficulty.includes(tier as 1 | 2 | 3)) return false;
  }
  return true;
}

function buildFieldTries(tracks: Track[]): Partial<Record<FieldId, string[]>> {
  const songTitles = new Set<string>();
  const artists = new Set<string>();
  const albums = new Set<string>();
  for (const track of tracks) {
    if (track.answers.song_title.value) songTitles.add(track.answers.song_title.value);
    if (track.answers.primary_artist.value) artists.add(track.answers.primary_artist.value);
    if (track.answers.album_name.value) albums.add(track.answers.album_name.value);
  }
  return {
    song_title: [...songTitles],
    primary_artist: [...artists],
    album_name: [...albums],
  };
}

export const useCatalogStore = create<CatalogStore>()(
  persist(
    (set, get) => ({
      tracks: [],
      fuseIndex: null,
      fieldTries: {},
      isLoading: false,

      loadCatalog: async () => {
        if (get().tracks.length > 0 || get().isLoading) return;
        set({ isLoading: true });
        try {
          const response = await fetch(CATALOG_URL);
          const tracks = (await response.json()) as Track[];
          set({
            tracks,
            fuseIndex: new Fuse(tracks, FUSE_OPTIONS),
            fieldTries: buildFieldTries(tracks),
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      search: (query, filters) => {
        const { tracks, fuseIndex } = get();
        const base = query.trim()
          ? (fuseIndex?.search(query).map((result) => result.item) ?? [])
          : tracks;
        return base.filter((track) => matchesFilters(track, filters));
      },

      getTrack: (id) => get().tracks.find((track) => track.track_id === id),
    }),
    {
      name: 'iktt-catalog',
      version: 1,
      partialize: (state) => ({ tracks: state.tracks }),
      onRehydrateStorage: () => (state) => {
        if (state && state.tracks.length > 0) {
          state.fuseIndex = new Fuse(state.tracks, FUSE_OPTIONS);
          state.fieldTries = buildFieldTries(state.tracks);
        }
      },
    },
  ),
);
