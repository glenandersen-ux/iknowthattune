import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSpotifyPreview } from './SpotifyPreview';

describe('fetchSpotifyPreview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the preview data from the Worker endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              previewUrl: 'https://p.scdn.co/mp3-preview/abc123',
              trackUrl: 'https://open.spotify.com/track/123',
              trackName: 'Rolling in the Deep',
              artistName: 'Adele',
            }),
        }),
      ),
    );

    const result = await fetchSpotifyPreview('Rolling in the Deep', 'Adele');
    expect(result).toEqual({
      previewUrl: 'https://p.scdn.co/mp3-preview/abc123',
      trackUrl: 'https://open.spotify.com/track/123',
      trackName: 'Rolling in the Deep',
      artistName: 'Adele',
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/spotify/preview?'),
    );
  });

  it('returns null when the Worker returns null (no preview available)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(null) })));
    expect(await fetchSpotifyPreview('Obscure Track', 'Unknown')).toBeNull();
  });

  it('returns null when the Worker responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503 })));
    expect(await fetchSpotifyPreview('Any', 'Artist')).toBeNull();
  });

  it('returns null when the network request throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));
    expect(await fetchSpotifyPreview('Any', 'Artist')).toBeNull();
  });
});
