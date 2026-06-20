import type { Env } from '../env';

export interface DeezerPreviewResult {
  previewUrl: string;
  trackUrl: string;
  trackName: string;
  artistName: string;
}

interface DeezerTrack {
  title: string;
  preview: string;
  link: string;
  artist: { name: string };
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handleDeezerRequest(_request: Request, _env: Env): Promise<Response> {
  if (_request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (_request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const url = new URL(_request.url);
  const title = url.searchParams.get('title')?.trim();
  const artist = url.searchParams.get('artist')?.trim();
  if (!title || !artist) {
    return new Response(JSON.stringify({ error: 'title and artist params required' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const result = await searchTrack(title, artist);
    if (!result) return new Response(JSON.stringify(null), { status: 200, headers: CORS_HEADERS });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return new Response(JSON.stringify(null), { status: 200, headers: CORS_HEADERS });
  }
}

async function deezerSearch(title: string, artist: string): Promise<DeezerPreviewResult | null> {
  const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  const response = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as DeezerSearchResponse;
  const track = data.data?.[0];
  if (!track?.preview) return null;
  return { previewUrl: track.preview, trackUrl: track.link, trackName: track.title, artistName: track.artist.name };
}

async function searchTrack(title: string, artist: string): Promise<DeezerPreviewResult | null> {
  const result = await deezerSearch(title, artist);
  if (result) return result;
  // Remix/remaster suffixes like "(KBm2k Reconstruction)" or "[Deluxe]" often
  // don't exist in Deezer under the full name. Strip them and retry.
  const baseTitle = title.replace(/\s*[\[(][^\])]*[\])]/g, '').trim();
  if (baseTitle && baseTitle !== title) return deezerSearch(baseTitle, artist);
  return null;
}
