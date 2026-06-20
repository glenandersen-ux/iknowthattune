/** A Deezer 30-second preview clip and its storefront link. */
export interface DeezerPreview {
  previewUrl: string;
  trackUrl: string;
  trackName: string;
  artistName: string;
}

/**
 * Asks the Cloudflare Worker to look up a Deezer preview URL for a track.
 * Deezer's API is free and requires no credentials; the Worker adds a 1-hour
 * CDN cache so repeated lookups for the same track are served instantly.
 */
export async function fetchDeezerPreview(
  songTitle: string,
  artistName: string,
): Promise<DeezerPreview | null> {
  const params = new URLSearchParams({ title: songTitle, artist: artistName });
  try {
    const response = await fetch(`/api/deezer/preview?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as DeezerPreview | null;
    if (!data?.previewUrl || !data.trackUrl) return null;
    return data;
  } catch {
    return null;
  }
}
