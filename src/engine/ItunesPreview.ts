/** A 30-second preview clip and storefront link returned by the iTunes Search API. */
export interface ItunesPreview {
  /** Direct URL to the preview audio clip. */
  previewUrl: string;
  /** Link to the track's Apple Music page, shown via the attribution badge. */
  trackViewUrl: string;
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/**
 * Looks up a track on the free iTunes Search API and returns its preview clip
 * and Apple Music link. Called on demand and never cached or redistributed —
 * this is the "BYOC fallback" for tracks with no working catalog clip,
 * consistent with Apple's preview usage being tied to a live storefront link.
 */
export async function fetchItunesPreview(songTitle: string, artistName: string): Promise<ItunesPreview | null> {
  const params = new URLSearchParams({
    term: `${songTitle} ${artistName}`,
    media: 'music',
    entity: 'song',
    limit: '1',
  });
  try {
    const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { results?: Array<{ previewUrl?: string; trackViewUrl?: string }> };
    const result = data.results?.[0];
    if (!result?.previewUrl || !result?.trackViewUrl) return null;
    return { previewUrl: result.previewUrl, trackViewUrl: result.trackViewUrl };
  } catch {
    return null;
  }
}
