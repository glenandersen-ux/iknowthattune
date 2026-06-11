import { describe, it, expect, vi } from 'vitest';
import './catalogIndexWorker';
import { hydrateFuseIndex } from '../engine/CatalogSearchIndex';
import type { CatalogIndexResponse } from './catalogIndexWorker';
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

describe('catalogIndexWorker', () => {
  it('responds to a message with a serialized Fuse index for the given tracks', () => {
    const tracks = [makeTrack('track-1', 'Bohemian Rhapsody')];
    const postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);

    self.onmessage?.call(self, { data: { tracks } } as MessageEvent);

    expect(postMessage).toHaveBeenCalledTimes(1);
    const response = postMessage.mock.calls[0]?.[0] as CatalogIndexResponse;
    const fuse = hydrateFuseIndex(tracks, response.index);
    expect(fuse.search('Bohemian').map((r) => r.item.track_id)).toEqual(['track-1']);

    vi.unstubAllGlobals();
  });
});
