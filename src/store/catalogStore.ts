import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Fuse from 'fuse.js';
import { FUSE_OPTIONS, hydrateFuseIndex, type SerializedFuseIndex } from '../engine/CatalogSearchIndex';
import { findUnplayableTrackIds } from '../engine/ClipAvailability';
import type { FieldId, FilterSet, Track } from '../types/track';

const CATALOG_URL = '/catalog/data/seed-tracks.json';
const SUGGESTION_POOL_URL = '/catalog/data/suggestion-pool.json';

/**
 * Text-only autocomplete suggestions (song titles, artists, albums) for
 * songs that aren't yet in the playable catalog. These widen the typeahead
 * pool without requiring audio clips.
 */
interface SuggestionPool {
  song_titles: string[];
  artists: string[];
  albums: string[];
}

const EMPTY_SUGGESTION_POOL: SuggestionPool = { song_titles: [], artists: [], albums: [] };

async function fetchSuggestionPool(): Promise<SuggestionPool> {
  try {
    const response = await fetch(SUGGESTION_POOL_URL);
    return (await response.json()) as SuggestionPool;
  } catch {
    return EMPTY_SUGGESTION_POOL;
  }
}

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
  /**
   * `track_id`s whose clip URLs all failed a reachability check
   * (`verifyPlayability`). Used to exclude tracks with no downloadable audio
   * from Daily Drop / Solo Sprint selection.
   */
  unplayableTrackIds: Set<string>;

  loadCatalog: () => Promise<void>;
  search: (query: string, filters: FilterSet) => Track[];
  getTrack: (id: string) => Track | undefined;
  /** Checks each track's clip URLs and records any that are entirely unreachable. */
  verifyPlayability: () => Promise<void>;
}

/** Returns `tracks` minus any flagged as unplayable by `verifyPlayability`. */
export function selectPlayableTracks(state: CatalogStore): Track[] {
  return state.tracks.filter((track) => !state.unplayableTrackIds.has(track.track_id));
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

function buildFieldTries(tracks: Track[], suggestionPool: SuggestionPool = EMPTY_SUGGESTION_POOL): Partial<Record<FieldId, string[]>> {
  const songTitles = new Set<string>(suggestionPool.song_titles);
  const artists = new Set<string>(suggestionPool.artists);
  // "Single" is always offered as an album suggestion, since tracks released
  // as standalone singles (rather than on an album) use it as their answer.
  const albums = new Set<string>(['Single', ...suggestionPool.albums]);
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
      unplayableTrackIds: new Set(),

      loadCatalog: async () => {
        if (get().tracks.length > 0 || get().isLoading) return;
        set({ isLoading: true });
        try {
          const [response, suggestionPool] = await Promise.all([fetch(CATALOG_URL), fetchSuggestionPool()]);
          const tracks = (await response.json()) as Track[];
          // Render with the catalog immediately; the Fuse index builds off the
          // main thread and is patched in once ready (Phase 4 §4.3).
          set({ tracks, fieldTries: buildFieldTries(tracks, suggestionPool), isLoading: false });
          const fuseIndex = await buildFuseIndex(tracks);
          set({ fuseIndex });
          void get().verifyPlayability();
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

      verifyPlayability: async () => {
        const { tracks } = get();
        if (tracks.length === 0) return;
        try {
          const unplayable = await findUnplayableTrackIds(tracks);
          set({ unplayableTrackIds: new Set(unplayable) });
        } catch {
          // Reachability check failed outright (e.g. offline); leave tracks as-is.
        }
      },
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
          void fetchSuggestionPool().then((suggestionPool) => {
            useCatalogStore.setState((current) => ({ fieldTries: buildFieldTries(current.tracks, suggestionPool) }));
          });
          void useCatalogStore.getState().verifyPlayability();
        }
      },
    },
  ),
);
