import { describe, it, expect } from 'vitest';
import { buildSerializedFuseIndex, hydrateFuseIndex } from './CatalogSearchIndex';
import type { Track } from '../types/track';

function makeTrack(id: string, title: string): Track {
  return {
    track_id: id,
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: title, aliases: [] },
      primary_artist: { value: 'Test Artist', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Test Album', aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
      genre: { value: ['Rock'] },
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
    metadata: { decade: 2000, language: 'en', tags: [], difficulty_score: 1 },
  };
}

describe('CatalogSearchIndex', () => {
  it('hydrates a serialized index that finds the same matches as a directly built one', () => {
    const tracks = [makeTrack('track-1', 'Bohemian Rhapsody'), makeTrack('track-2', 'Billie Jean')];

    const serialized = buildSerializedFuseIndex(tracks);
    const fuse = hydrateFuseIndex(tracks, serialized);

    const results = fuse.search('Bohemian').map((result) => result.item.track_id);
    expect(results).toEqual(['track-1']);
  });
});
