import { describe, it, expect, vi, afterEach } from 'vitest';
import { isClipAvailable, findUnplayableTrackIds } from './ClipAvailability';
import type { Track } from '../types/track';

function makeTrack(trackId: string, clipUrls: Partial<Record<'1s' | '3s' | '5s' | '10s' | '30s', string>>): Track {
  return {
    track_id: trackId,
    clip_urls: { '1s': 'a', '3s': 'a', '5s': 'a', '10s': 'a', '30s': 'a', ...clipUrls },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: 'Title', aliases: [] },
      primary_artist: { value: 'Artist', aliases: [] },
      release_year: { value: 2000, tolerance: 2 },
      album_name: { value: 'Album', aliases: [] },
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

describe('ClipAvailability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isClipAvailable returns true when at least one clip URL responds OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => Promise.resolve({ ok: url === 'good' })),
    );

    const track = makeTrack('track-1', { '1s': 'bad', '3s': 'good', '5s': 'bad', '10s': 'bad', '30s': 'bad' });
    expect(await isClipAvailable(track)).toBe(true);
  });

  it('isClipAvailable returns false when every clip URL is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));

    const track = makeTrack('track-1', {});
    expect(await isClipAvailable(track)).toBe(false);
  });

  it('isClipAvailable returns false when fetch rejects entirely', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));

    const track = makeTrack('track-1', {});
    expect(await isClipAvailable(track)).toBe(false);
  });

  it('findUnplayableTrackIds returns only the IDs of tracks with no working clip URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => Promise.resolve({ ok: url === 'good' })),
    );

    const tracks = [
      makeTrack('playable', { '1s': 'good', '3s': 'good', '5s': 'good', '10s': 'good', '30s': 'good' }),
      makeTrack('unplayable', { '1s': 'bad', '3s': 'bad', '5s': 'bad', '10s': 'bad', '30s': 'bad' }),
    ];

    expect(await findUnplayableTrackIds(tracks)).toEqual(['unplayable']);
  });
});
