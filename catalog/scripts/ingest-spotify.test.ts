import { describe, it, expect } from 'vitest';
import { mapKeySignature, mapSpotifyTrackToTrack, parseReleaseYear } from './ingest-spotify';
import type { SpotifyAudioFeatures, SpotifyTrack } from './ingest-spotify';

describe('mapKeySignature', () => {
  it('maps pitch class and mode to the canonical key signature label', () => {
    expect(mapKeySignature(0, 1)).toBe('C major');
    expect(mapKeySignature(10, 0)).toBe('B♭ minor');
    expect(mapKeySignature(6, 1)).toBe('F♯ major');
  });

  it('returns null for an undetected key', () => {
    expect(mapKeySignature(-1, 1)).toBeNull();
  });
});

describe('parseReleaseYear', () => {
  it('extracts the year from full, month-precision, and year-only dates', () => {
    expect(parseReleaseYear('1983-01-02')).toBe(1983);
    expect(parseReleaseYear('1975-11')).toBe(1975);
    expect(parseReleaseYear('2001')).toBe(2001);
  });
});

describe('mapSpotifyTrackToTrack', () => {
  const spotifyTrack: SpotifyTrack = {
    id: 'abc123',
    name: 'Test Song',
    artists: [{ id: 'artist-1', name: 'Test Artist' }, { id: 'artist-2', name: 'Featured Act' }],
    album: { name: 'Test Album', release_date: '1999-05-01' },
    preview_url: 'https://p.scdn.co/mp3-preview/abc123',
  };
  const audioFeatures: SpotifyAudioFeatures = { tempo: 120.4, key: 2, mode: 1 };

  it('maps Spotify fields onto the Track schema, leaving niche fields null', () => {
    const track = mapSpotifyTrackToTrack('tk_test_song', spotifyTrack, audioFeatures, ['rock', 'pop']);

    expect(track.track_id).toBe('tk_test_song');
    expect(track.answers.song_title.value).toBe('Test Song');
    expect(track.answers.primary_artist.value).toBe('Test Artist');
    expect(track.answers.featured_artist.value).toBe('Featured Act');
    expect(track.answers.release_year.value).toBe(1999);
    expect(track.answers.album_name.value).toBe('Test Album');
    expect(track.answers.genre.value).toEqual(['rock', 'pop']);
    expect(track.answers.bpm.value).toBe(120);
    expect(track.answers.key_signature.value).toBe('D major');
    expect(track.answers.sample_source.value).toBeNull();
    expect(track.answers.songwriter.value).toEqual([]);
    expect(track.metadata.decade).toBe(1990);
    expect(track.clip_urls['1s']).toBe('https://p.scdn.co/mp3-preview/abc123');
  });

  it('handles missing audio features and a single-artist track', () => {
    const soloTrack: SpotifyTrack = { ...spotifyTrack, artists: [{ id: 'artist-1', name: 'Solo Artist' }] };
    const track = mapSpotifyTrackToTrack('tk_solo', soloTrack, null, []);

    expect(track.answers.featured_artist.value).toBeNull();
    expect(track.answers.bpm.value).toBeNull();
    expect(track.answers.key_signature.value).toBeNull();
  });
});
