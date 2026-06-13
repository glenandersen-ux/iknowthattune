import type { Track } from '../types/track';

/**
 * Returns `true` if at least one of the track's clip URLs responds
 * successfully to a `HEAD` request. Mirrors `AudioEngine.preloadTrack`'s
 * "playable as long as one URL works" tolerance, so a track that the engine
 * could actually play isn't marked unavailable.
 */
export async function isClipAvailable(track: Track): Promise<boolean> {
  const urls = new Set(Object.values(track.clip_urls));
  const results = await Promise.allSettled(
    [...urls].map(async (url) => {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) throw new Error(`status ${response.status}`);
    }),
  );
  return results.some((result) => result.status === 'fulfilled');
}

/** Returns the `track_id`s of any tracks whose clip URLs are all unreachable. */
export async function findUnplayableTrackIds(tracks: Track[]): Promise<string[]> {
  const checks = await Promise.all(
    tracks.map(async (track) => ({ id: track.track_id, playable: await isClipAvailable(track) })),
  );
  return checks.filter((check) => !check.playable).map((check) => check.id);
}
