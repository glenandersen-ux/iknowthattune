import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fuse from 'fuse.js';
import { selectPlayableTracks, useCatalogStore } from './catalogStore';
import type { Track } from '../types/track';

function makeTrack(overrides: Partial<Track>): Track {
  return {
    track_id: 'track-1',
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: 'Bohemian Rhapsody', aliases: [] },
      primary_artist: { value: 'Queen', aliases: [] },
      release_year: { value: 1975, tolerance: 2 },
      album_name: { value: 'A Night at the Opera', aliases: [] },
      songwriter: { value: ['Freddie Mercury'], partial_credit: true },
      producer: { value: 'Roy Thomas Baker', aliases: [] },
      record_label: { value: 'EMI', aliases: [] },
      genre: { value: ['Rock'] },
      band_members: { value: ['Freddie Mercury', 'Brian May'], partial_credit: true },
      featured_artist: { value: null },
      bpm: { value: 72, tolerance: 5 },
      key_signature: { value: 'Bb major' },
      chart_peak: { value: 1, tolerance: 2 },
      sample_source: { value: null },
      certified_copies: { value: null },
      music_video_director: { value: null },
      opening_lyric: { value: 'Is this the real life', fuzzy_tolerance: 2 },
      instrument_solo: { value: ['guitar'] },
      covered_by: { value: [], partial_credit: false },
      soundtrack: { value: null },
    },
    metadata: {
      decade: 1970,
      language: 'en',
      tags: ['classic-rock'],
      difficulty_score: 2.0,
    },
    ...overrides,
  };
}

describe('catalogStore', () => {
  beforeEach(() => {
    useCatalogStore.setState({ tracks: [], fuseIndex: null, fieldTries: {}, isLoading: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubCatalogFetch(tracks: Track[], suggestionPool?: { song_titles: string[]; artists: string[]; albums: string[] }): void {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('suggestion-pool')) {
          return Promise.resolve({
            json: () => Promise.resolve(suggestionPool ?? { song_titles: [], artists: [], albums: [] }),
          });
        }
        return Promise.resolve({ json: () => Promise.resolve(tracks) });
      }),
    );
  }

  it('loadCatalog fetches and indexes tracks', async () => {
    const tracks = [makeTrack({ track_id: 'track-1' })];
    stubCatalogFetch(tracks);

    await useCatalogStore.getState().loadCatalog();

    const state = useCatalogStore.getState();
    expect(state.tracks).toHaveLength(1);
    expect(state.fuseIndex).not.toBeNull();
    expect(state.fieldTries.song_title).toContain('Bohemian Rhapsody');
  });

  it('always offers "Single" as an album suggestion, for tracks released without an album', async () => {
    const tracks = [makeTrack({ track_id: 'track-1' })];
    stubCatalogFetch(tracks);

    await useCatalogStore.getState().loadCatalog();

    expect(useCatalogStore.getState().fieldTries.album_name).toContain('Single');
  });

  it('merges the suggestion pool into the autocomplete lists', async () => {
    const tracks = [makeTrack({ track_id: 'track-1' })];
    stubCatalogFetch(tracks, {
      song_titles: ['Yesterday'],
      artists: ['The Beatles'],
      albums: ['Abbey Road'],
    });

    await useCatalogStore.getState().loadCatalog();

    const state = useCatalogStore.getState();
    expect(state.fieldTries.song_title).toContain('Yesterday');
    expect(state.fieldTries.primary_artist).toContain('The Beatles');
    expect(state.fieldTries.album_name).toContain('Abbey Road');
  });

  it('search filters by query and decade', () => {
    const tracks = [
      makeTrack({ track_id: 'track-1', metadata: { decade: 1970, language: 'en', tags: [], difficulty_score: 2 } }),
      makeTrack({
        track_id: 'track-2',
        answers: {
          ...makeTrack({}).answers,
          song_title: { value: 'Billie Jean', aliases: [] },
          primary_artist: { value: 'Michael Jackson', aliases: [] },
        },
        metadata: { decade: 1980, language: 'en', tags: [], difficulty_score: 1.5 },
      }),
    ];
    useCatalogStore.setState({
      tracks,
      fuseIndex: new Fuse(tracks, { keys: ['answers.song_title.value'] }),
    });

    const results = useCatalogStore.getState().search('', { decade: [1980] });
    expect(results).toHaveLength(1);
    expect(results[0]?.track_id).toBe('track-2');
  });

  it('verifyPlayability flags tracks whose clip URLs are all unreachable', async () => {
    const playable = makeTrack({ track_id: 'playable', clip_urls: { '1s': 'good', '3s': 'good', '5s': 'good', '10s': 'good', '30s': 'good' } });
    const unplayable = makeTrack({ track_id: 'unplayable', clip_urls: { '1s': 'bad', '3s': 'bad', '5s': 'bad', '10s': 'bad', '30s': 'bad' } });
    useCatalogStore.setState({ tracks: [playable, unplayable], unplayableTrackIds: new Set() });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => Promise.resolve({ ok: url === 'good' })),
    );

    await useCatalogStore.getState().verifyPlayability();

    const state = useCatalogStore.getState();
    expect(state.unplayableTrackIds).toEqual(new Set(['unplayable']));
    expect(selectPlayableTracks(state)).toEqual([playable]);
  });

  it('getTrack returns the matching track or undefined', () => {
    const tracks = [makeTrack({ track_id: 'track-1' })];
    useCatalogStore.setState({ tracks });
    expect(useCatalogStore.getState().getTrack('track-1')?.track_id).toBe('track-1');
    expect(useCatalogStore.getState().getTrack('missing')).toBeUndefined();
  });

  it('starts with an empty track list (catalog is fetched over HTTP, not persisted)', () => {
    // The catalog store no longer uses localStorage — HTTP cache handles
    // repeat visits and avoids the 5-10MB localStorage quota at 10K+ tracks.
    expect(useCatalogStore.getState().tracks).toHaveLength(0);
  });
});
