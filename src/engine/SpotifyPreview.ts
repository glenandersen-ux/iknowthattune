/** A Spotify 30-second preview clip and its storefront link. */
export interface SpotifyPreview {
  previewUrl: string;
  trackUrl: string;
  trackName: string;
  artistName: string;
}

/**
 * Asks the Cloudflare Worker to look up a Spotify preview URL for a track.
 *
 * The Worker holds the client secret and handles token refresh; this module
 * only passes the title/artist and receives back a preview URL or null.
 * Audio is streamed directly from Spotify's CDN — no server-side audio proxy,
 * satisfying the "stream only" requirement of Spotify's Developer ToS §IV.3.
 */
export async function fetchSpotifyPreview(
  songTitle: string,
  artistName: string,
): Promise<SpotifyPreview | null> {
  const params = new URLSearchParams({ title: songTitle, artist: artistName });
  try {
    const response = await fetch(`/api/spotify/preview?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as SpotifyPreview | null;
    if (!data?.previewUrl || !data.trackUrl) return null;
    return data;
  } catch {
    return null;
  }
}
