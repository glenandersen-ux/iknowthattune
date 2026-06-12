import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Fuse from 'fuse.js';
import { FUSE_OPTIONS, hydrateFuseIndex, type SerializedFuseIndex } from '../engine/CatalogSearchIndex';
import type { FieldId, FilterSet, Track } from '../types/track';

const CATALOG_URL = '/catalog/data/seed-tracks.json';

/**
 * Builds the Fuse index off the main thread when Web Workers are available
 * (Phase 4 §4.3). Falls back to a synchronous build (e.g. in test environments
 * where `Worker` is undefined).
 */
function buildFuseIndex(tracks: Track[]): Promise<Fuse<Track>> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(new Fuse(tracks, FUSE_OPTIONS));
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/catalogIndexWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ index: SerializedFuseIndex }>): void => {
      resolve(hydrateFuseIndex(tracks, event.data.index));
      worker.terminate();
    };
    worker.postMessage({ tracks });
  });
}

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
          // Render with the catalog immediately; the Fuse index builds off the
          // main thread and is patched in once ready (Phase 4 §4.3).
          set({ tracks, fieldTries: buildFieldTries(tracks), isLoading: false });
          const fuseIndex = await buildFuseIndex(tracks);
          set({ fuseIndex });
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
      version: 2,
      partialize: (state) => ({ tracks: state.tracks }),
      // v2: catalog expanded from 5 to 19 tracks. Discard any persisted v1
      // catalog so clients refetch the new track list instead of being
      // stuck on the stale 5-track set forever.
      migrate: (_persistedState, version) => {
        if (version < 2) {
          return { tracks: [] };
        }
        return _persistedState as { tracks: Track[] };
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.tracks.length > 0) {
          state.fieldTries = buildFieldTries(state.tracks);
          void buildFuseIndex(state.tracks).then((fuseIndex) => {
            useCatalogStore.setState({ fuseIndex });
          });
        }
      },
    },
  ),
);
