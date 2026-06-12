import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClipDuration, Track } from '../../src/types/track';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/** Subset of the iTunes Search API track result used here. */
export interface ITunesTrackResult {
  trackName: string;
  artistName: string;
  previewUrl?: string;
}

/**
 * Picks the best iTunes search result for a track: prefers an exact
 * (case-insensitive) artist name match, falling back to the first result.
 */
export function pickBestMatch(results: ITunesTrackResult[], artist: string): ITunesTrackResult | null {
  if (results.length === 0) return null;
  const exact = results.find((result) => result.artistName.toLowerCase() === artist.toLowerCase());
  return exact ?? results[0] ?? null;
}

/** Builds a `clip_urls` map with every duration pointing at the same preview URL. */
export function buildClipUrls(previewUrl: string): Record<ClipDuration, string> {
  return Object.fromEntries(
    (['1s', '3s', '5s', '10s', '30s'] as ClipDuration[]).map((duration) => [duration, previewUrl]),
  ) as Record<ClipDuration, string>;
}

async function searchPreview(title: string, artist: string): Promise<string | null> {
  const term = `${artist} ${title}`;
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=song&limit=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`iTunes search failed for "${term}": ${response.status}`);
  const json = (await response.json()) as { results: ITunesTrackResult[] };
  const match = pickBestMatch(json.results, artist);
  return match?.previewUrl ?? null;
}

async function main(): Promise<void> {
  const tracksDir = join(import.meta.dirname, '..', 'data', 'tracks');
  if (!existsSync(tracksDir)) {
    console.log(`No track files found in ${tracksDir}.`);
    return;
  }

  const files = readdirSync(tracksDir).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const path = join(tracksDir, file);
    const track = JSON.parse(readFileSync(path, 'utf-8')) as Track;

    if (track.clip_urls['30s']) {
      console.log(`Skipping ${track.track_id}: clip_urls already set.`);
      continue;
    }

    const title = track.answers.song_title.value;
    const artist = track.answers.primary_artist.value;
    if (!title || !artist) {
      console.warn(`  - ${track.track_id}: missing song_title or primary_artist, skipping.`);
      continue;
    }
    const previewUrl = await searchPreview(title, artist);

    if (!previewUrl) {
      console.warn(`  - ${track.track_id}: no iTunes preview found for "${title}" by "${artist}".`);
      continue;
    }

    track.clip_urls = buildClipUrls(previewUrl);
    writeFileSync(path, `${JSON.stringify(track, null, 2)}\n`);
    console.log(`Filled ${track.track_id} from iTunes preview.`);
  }

  console.log('\nRun "npm run catalog:build" to merge updated clip_urls into catalog/data/seed-tracks.json.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}
