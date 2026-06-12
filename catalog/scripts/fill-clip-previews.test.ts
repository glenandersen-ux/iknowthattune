import { describe, it, expect } from 'vitest';
import { buildClipUrls, pickBestMatch, type ITunesTrackResult } from './fill-clip-previews';

describe('pickBestMatch', () => {
  it('returns null for no results', () => {
    expect(pickBestMatch([], 'Adele')).toBeNull();
  });

  it('prefers an exact case-insensitive artist match', () => {
    const results: ITunesTrackResult[] = [
      { trackName: 'Rolling in the Deep (Live)', artistName: 'Some Cover Band', previewUrl: 'https://example.com/cover.m4a' },
      { trackName: 'Rolling in the Deep', artistName: 'adele', previewUrl: 'https://example.com/original.m4a' },
    ];
    expect(pickBestMatch(results, 'Adele')).toEqual(results[1]);
  });

  it('falls back to the first result when no artist matches exactly', () => {
    const results: ITunesTrackResult[] = [
      { trackName: 'Rolling in the Deep (Cover)', artistName: 'Some Cover Band', previewUrl: 'https://example.com/cover.m4a' },
    ];
    expect(pickBestMatch(results, 'Adele')).toEqual(results[0]);
  });
});

describe('buildClipUrls', () => {
  it('maps every clip duration to the same preview URL', () => {
    const url = 'https://example.com/preview.m4a';
    expect(buildClipUrls(url)).toEqual({
      '1s': url,
      '3s': url,
      '5s': url,
      '10s': url,
      '30s': url,
    });
  });
});
