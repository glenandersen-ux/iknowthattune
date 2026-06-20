import type { Env } from '../env';

export interface SpotifyPreviewResult {
  previewUrl: string;
  trackUrl: string;
  trackName: string;
  artistName: string;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyTrack {
  name: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  artists: Array<{ name: string }>;
}

interface SpotifySearchResponse {
  tracks: { items: SpotifyTrack[] };
}

// Module-level token cache — lives for the duration of a Worker instance
// (typically minutes to hours), so most requests reuse the same token rather
// than hitting the auth endpoint on every lookup.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const credentials = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error(`Spotify auth failed: ${response.status}`);
  const data = (await response.json()) as SpotifyTokenResponse;
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.value;
}

async function searchTrack(
  title: string,
  artist: string,
  token: string,
): Promise<SpotifyPreviewResult | null> {
  // Use field filters for tighter matching (avoids cover-version noise).
  const q = `track:${title} artist:${artist}`;
  const params = new URLSearchParams({ q, type: 'track', limit: '1', market: 'US' });
  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as SpotifySearchResponse;
  const track = data.tracks?.items?.[0];
  if (!track?.preview_url) return null;
  return {
    previewUrl: track.preview_url,
    trackUrl: track.external_urls.spotify,
    trackName: track.name,
    artistName: track.artists[0]?.name ?? artist,
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handleSpotifyRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Spotify credentials not configured' }), {
      status: 503,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(request.url);
  const title = url.searchParams.get('title')?.trim();
  const artist = url.searchParams.get('artist')?.trim();
  if (!title || !artist) {
    return new Response(JSON.stringify({ error: 'title and artist params required' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const token = await getAccessToken(env);
    const result = await searchTrack(title, artist, token);
    if (!result) {
      return new Response(JSON.stringify(null), { status: 200, headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      // Cache at the CDN for 1 hour — the URL is valid well past that window,
      // and this avoids hammering the Spotify API for the same track repeatedly.
      // NOTE: the audio itself is still streamed directly from p.scdn.co with
      // no server-side caching, satisfying Spotify ToS §IV.3.
      headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}
