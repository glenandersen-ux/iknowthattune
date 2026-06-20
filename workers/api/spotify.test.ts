import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSpotifyRequest } from './spotify';
import type { Env } from '../env';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockEnv: Env = {
  CHALLENGES_KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  LEADERBOARD: {} as DurableObjectNamespace,
  SPOTIFY_CLIENT_ID: 'test-client-id',
  SPOTIFY_CLIENT_SECRET: 'test-client-secret',
};

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('https://iknowthattune.com/api/spotify/preview');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

function mockTokenResponse(): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ access_token: 'mock-token', expires_in: 3600 }),
  });
}

function mockSearchResponse(previewUrl: string | null): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        tracks: {
          items: previewUrl
            ? [
                {
                  name: 'Rolling in the Deep',
                  preview_url: previewUrl,
                  external_urls: { spotify: 'https://open.spotify.com/track/123' },
                  artists: [{ name: 'Adele' }],
                },
              ]
            : [],
        },
      }),
  });
}

describe('handleSpotifyRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns 400 when title or artist params are missing', async () => {
    const response = await handleSpotifyRequest(makeRequest({ title: 'Rolling in the Deep' }), mockEnv);
    expect(response.status).toBe(400);
  });

  it('returns the preview URL and track link when Spotify finds a match', async () => {
    mockTokenResponse();
    mockSearchResponse('https://p.scdn.co/mp3-preview/abc123');

    const response = await handleSpotifyRequest(
      makeRequest({ title: 'Rolling in the Deep', artist: 'Adele' }),
      mockEnv,
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { previewUrl: string; trackUrl: string; trackName: string; artistName: string };
    expect(body.previewUrl).toBe('https://p.scdn.co/mp3-preview/abc123');
    expect(body.trackUrl).toBe('https://open.spotify.com/track/123');
    expect(body.trackName).toBe('Rolling in the Deep');
    expect(body.artistName).toBe('Adele');
  });

  it('returns null (200) when Spotify has no preview for the track', async () => {
    mockTokenResponse();
    mockSearchResponse(null);

    const response = await handleSpotifyRequest(
      makeRequest({ title: 'Some Obscure Track', artist: 'Unknown Artist' }),
      mockEnv,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('returns 503 when credentials are not configured', async () => {
    const unconfiguredEnv = { ...mockEnv, SPOTIFY_CLIENT_ID: '', SPOTIFY_CLIENT_SECRET: '' };
    const response = await handleSpotifyRequest(makeRequest({ title: 'Any', artist: 'Artist' }), unconfiguredEnv);
    expect(response.status).toBe(503);
  });

  it('returns 204 for OPTIONS preflight requests', async () => {
    const response = await handleSpotifyRequest(
      new Request('https://iknowthattune.com/api/spotify/preview', { method: 'OPTIONS' }),
      mockEnv,
    );
    expect(response.status).toBe(204);
  });
});
