import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Track } from '../../src/types/track';

/**
 * Merges hand-curated tracks with tracks ingested by `ingest-spotify.ts`
 * (one JSON file per track in `catalog/data/tracks/`). Existing entries win
 * on `track_id` collisions, so hand-tuned niche trivia is never clobbered by
 * a re-ingest; ingested tracks only ever *add* new entries.
 */
export function mergeCatalogs(existing: Track[], ingested: Track[]): Track[] {
  const byId = new Map(existing.map((track) => [track.track_id, track]));
  for (const track of ingested) {
    if (!byId.has(track.track_id)) {
      byId.set(track.track_id, track);
    }
  }
  return [...byId.values()].sort((a, b) => a.track_id.localeCompare(b.track_id));
}

function main(): void {
  const root = join(import.meta.dirname, '..', '..');
  const dataDir = join(root, 'catalog', 'data');
  const tracksDir = join(dataDir, 'tracks');
  const seedPath = join(dataDir, 'seed-tracks.json');
  const publicPath = join(root, 'public', 'catalog', 'data', 'seed-tracks.json');

  const existing = JSON.parse(readFileSync(seedPath, 'utf-8')) as Track[];

  let ingested: Track[] = [];
  if (existsSync(tracksDir)) {
    const files = readdirSync(tracksDir).filter((file) => file.endsWith('.json'));
    ingested = files.map((file) => JSON.parse(readFileSync(join(tracksDir, file), 'utf-8')) as Track);
  }

  const merged = mergeCatalogs(existing, ingested);
  const json = `${JSON.stringify(merged, null, 2)}\n`;

  writeFileSync(seedPath, json);
  writeFileSync(publicPath, json);

  console.log(`Wrote ${merged.length} tracks to ${seedPath} and ${publicPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
