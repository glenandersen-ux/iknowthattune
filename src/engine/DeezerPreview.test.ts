import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDeezerPreview } from './DeezerPreview';

describe('fetchDeezerPreview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns preview data from the Worker endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              previewUrl: 'https://cdns-preview.dzcdn.net/stream/abc.mp3',
              trackUrl: 'https://www.deezer.com/track/123',
              trackName: 'Rolling in the Deep',
              artistName: 'Adele',
            }),
        }),
      ),
    );
    const result = await fetchDeezerPreview('Rolling in the Deep', 'Adele');
    expect(result).toEqual({
      previewUrl: 'https://cdns-preview.dzcdn.net/stream/abc.mp3',
      trackUrl: 'https://www.deezer.com/track/123',
      trackName: 'Rolling in the Deep',
      artistName: 'Adele',
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('/api/deezer/preview?'));
  });

  it('returns null when the Worker returns null', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(null) })));
    expect(await fetchDeezerPreview('Unknown', 'Nobody')).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 502 })));
    expect(await fetchDeezerPreview('Any', 'Artist')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));
    expect(await fetchDeezerPreview('Any', 'Artist')).toBeNull();
  });
});
