import { describe, it, expect } from 'vitest';
import { mergeCatalogs } from './build-catalog';
import { mapSpotifyTrackToTrack } from './ingest-spotify';
import type { SpotifyTrack } from './ingest-spotify';

function makeSpotifyTrack(id: string, name: string): SpotifyTrack {
  return {
    id,
    name,
    artists: [{ id: `artist-${id}`, name: `Artist ${id}` }],
    album: { name: `Album ${id}`, release_date: '2000-01-01' },
    preview_url: `https://p.scdn.co/mp3-preview/${id}`,
  };
}

describe('mergeCatalogs', () => {
  it('adds new ingested tracks that are not already in the existing catalog', () => {
    const existing = [mapSpotifyTrackToTrack('tk_existing', makeSpotifyTrack('existing', 'Existing Song'), null, [])];
    const ingested = [mapSpotifyTrackToTrack('tk_new', makeSpotifyTrack('new', 'New Song'), null, [])];

    const merged = mergeCatalogs(existing, ingested);

    expect(merged.map((t) => t.track_id)).toEqual(['tk_existing', 'tk_new']);
  });

  it('keeps the existing entry when an ingested track shares its track_id', () => {
    const curated = mapSpotifyTrackToTrack('tk_shared', makeSpotifyTrack('curated', 'Curated Title'), null, []);
    curated.metadata.curator_note = 'hand-tuned niche trivia';
    const reingested = mapSpotifyTrackToTrack('tk_shared', makeSpotifyTrack('shared', 'Re-ingested Title'), null, []);

    const merged = mergeCatalogs([curated], [reingested]);

    expect(merged).toHaveLength(1);
    expect(merged[0].answers.song_title.value).toBe('Curated Title');
    expect(merged[0].metadata.curator_note).toBe('hand-tuned niche trivia');
  });

  it('sorts the merged result by track_id', () => {
    const a = mapSpotifyTrackToTrack('tk_b', makeSpotifyTrack('b', 'B'), null, []);
    const b = mapSpotifyTrackToTrack('tk_a', makeSpotifyTrack('a', 'A'), null, []);

    const merged = mergeCatalogs([a], [b]);

    expect(merged.map((t) => t.track_id)).toEqual(['tk_a', 'tk_b']);
  });

  it('returns the existing catalog unchanged when there is nothing to ingest', () => {
    const existing = [mapSpotifyTrackToTrack('tk_only', makeSpotifyTrack('only', 'Only Song'), null, [])];

    const merged = mergeCatalogs(existing, []);

    expect(merged).toEqual(existing);
  });
});
