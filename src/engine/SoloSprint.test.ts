import { describe, it, expect } from 'vitest';
import {
  buildSoloSprintSeed,
  filterTracksForSoloSprint,
  listDecades,
  listGenres,
  pickRandomTracks,
} from './SoloSprint';
import type { Track } from '../types/track';

function buildTrack(id: string, genre: string[], decade: number, artist: string): Track {
  return {
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: `Song ${id}`, aliases: [] },
      primary_artist: { value: artist, aliases: [] },
      release_year: { value: decade, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
      genre: { value: genre },
      band_members: { value: [], partial_credit: true },
      featured_artist: { value: null },
      bpm: { value: null, tolerance: 5 },
      key_signature: { value: null },
      chart_peak: { value: null, tolerance: 2 },
      sample_source: { value: null },
      certified_copies: { value: null },
      music_video_director: { value: null },
      opening_lyric: { value: null, fuzzy_tolerance: 2 },
      instrument_solo: { value: null },
      covered_by: { value: [], partial_credit: true },
      soundtrack: { value: null },
    },
    metadata: { decade, language: 'en', tags: [], difficulty_score: 1 },
  };
}

const tracks: Track[] = [
  buildTrack('tk1', ['Rock'], 1970, 'Queen'),
  buildTrack('tk2', ['Pop'], 1980, 'Michael Jackson'),
  buildTrack('tk3', ['Rock', 'Pop'], 1990, 'Nirvana'),
];

describe('listGenres', () => {
  it('returns distinct sorted genres', () => {
    expect(listGenres(tracks)).toEqual(['Pop', 'Rock']);
  });
});

describe('listDecades', () => {
  it('returns distinct sorted decades', () => {
    expect(listDecades(tracks)).toEqual([1970, 1980, 1990]);
  });
});

describe('filterTracksForSoloSprint', () => {
  it('filters by genre', () => {
    const result = filterTracksForSoloSprint(tracks, { genres: ['Pop'], decades: [], artist: '' });
    expect(result.map((t) => t.track_id)).toEqual(['tk2', 'tk3']);
  });

  it('filters by decade', () => {
    const result = filterTracksForSoloSprint(tracks, { genres: [], decades: [1970], artist: '' });
    expect(result.map((t) => t.track_id)).toEqual(['tk1']);
  });

  it('filters by artist substring, case-insensitively', () => {
    const result = filterTracksForSoloSprint(tracks, { genres: [], decades: [], artist: 'queen' });
    expect(result.map((t) => t.track_id)).toEqual(['tk1']);
  });

  it('returns all tracks when no filters are applied', () => {
    expect(filterTracksForSoloSprint(tracks, { genres: [], decades: [], artist: '' })).toHaveLength(3);
  });
});

describe('pickRandomTracks', () => {
  it('returns the requested count, capped at the pool size', () => {
    expect(pickRandomTracks(tracks, 2, () => 0)).toHaveLength(2);
    expect(pickRandomTracks(tracks, 10, () => 0)).toHaveLength(3);
  });

  it('uses the provided random function deterministically', () => {
    const result = pickRandomTracks(tracks, 3, () => 0);
    expect(result.map((t) => t.track_id)).toEqual(['tk2', 'tk3', 'tk1']);
  });
});

describe('buildSoloSprintSeed', () => {
  it('joins track IDs with commas', () => {
    expect(buildSoloSprintSeed(tracks)).toBe('tk1,tk2,tk3');
  });
});
