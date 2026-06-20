import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeezerRequest } from './deezer';
import type { Env } from '../env';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockEnv = {
  CHALLENGES_KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  LEADERBOARD: {} as DurableObjectNamespace,
  SPOTIFY_CLIENT_ID: '',
  SPOTIFY_CLIENT_SECRET: '',
} satisfies Env;

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('https://iknowthattune.com/api/deezer/preview');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

describe('handleDeezerRequest', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns a preview URL and track link when Deezer finds a match', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              title: 'Rolling in the Deep',
              preview: 'https://cdns-preview.dzcdn.net/stream/abc.mp3',
              link: 'https://www.deezer.com/track/123',
              artist: { name: 'Adele' },
            },
          ],
        }),
    });

    const response = await handleDeezerRequest(makeRequest({ title: 'Rolling in the Deep', artist: 'Adele' }), mockEnv);
    expect(response.status).toBe(200);
    const body = await response.json() as { previewUrl: string; trackUrl: string };
    expect(body.previewUrl).toBe('https://cdns-preview.dzcdn.net/stream/abc.mp3');
    expect(body.trackUrl).toBe('https://www.deezer.com/track/123');
  });

  it('returns null when no results are found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });
    const response = await handleDeezerRequest(makeRequest({ title: 'Unknown', artist: 'Nobody' }), mockEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('returns 400 when title or artist is missing', async () => {
    const response = await handleDeezerRequest(makeRequest({ title: 'Only Title' }), mockEnv);
    expect(response.status).toBe(400);
  });

  it('returns 204 for OPTIONS preflight requests', async () => {
    const response = await handleDeezerRequest(
      new Request('https://iknowthattune.com/api/deezer/preview', { method: 'OPTIONS' }),
      mockEnv,
    );
    expect(response.status).toBe(204);
  });
});
