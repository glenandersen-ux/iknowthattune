import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchItunesPreview } from './ItunesPreview';

describe('ItunesPreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the preview URL and Apple Music link for the top result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ previewUrl: 'https://audio.example/preview.m4a', trackViewUrl: 'https://music.apple.com/track/1' }],
            }),
        }),
      ),
    );

    const result = await fetchItunesPreview('Some Song', 'Some Artist');
    expect(result).toEqual({ previewUrl: 'https://audio.example/preview.m4a', trackViewUrl: 'https://music.apple.com/track/1' });
  });

  it('returns null when no results are found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) })),
    );

    expect(await fetchItunesPreview('Nonexistent Song', 'Nobody')).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));

    expect(await fetchItunesPreview('Some Song', 'Some Artist')).toBeNull();
  });

  it('returns null when fetch rejects entirely', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));

    expect(await fetchItunesPreview('Some Song', 'Some Artist')).toBeNull();
  });
});
