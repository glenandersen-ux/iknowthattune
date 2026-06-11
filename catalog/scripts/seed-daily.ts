import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDailyTrackId, todayIso } from '../../src/engine/DailyDrop';
import type { Track } from '../../src/types/track';

/** KV namespace binding holding `daily:YYYY-MM-DD` -> track ID lookups (`wrangler.toml`). */
export const KV_BINDING = 'CHALLENGES_KV';

/** The KV key for a given date's Daily Drop. */
export function buildDailyKey(date: string): string {
  return `daily:${date}`;
}

/** Arguments for `wrangler kv key put`, given a date, track ID, and locality. */
export function buildSeedDailyArgs(date: string, trackId: string, local: boolean): string[] {
  const args = ['kv', 'key', 'put', `--binding=${KV_BINDING}`, buildDailyKey(date), trackId, '--remote'];
  if (local) {
    args[args.length - 1] = '--local';
  }
  return args;
}

function main(): void {
  const local = !process.argv.includes('--remote');
  const dataPath = join(import.meta.dirname, '..', 'data', 'seed-tracks.json');
  const tracks = JSON.parse(readFileSync(dataPath, 'utf-8')) as Track[];

  const date = todayIso();
  const trackId = getDailyTrackId(tracks, date);
  if (trackId === null) {
    throw new Error('No tracks available to seed the Daily Drop');
  }

  const args = buildSeedDailyArgs(date, trackId, local);
  console.log(`Seeding daily:${date} -> ${trackId} (${local ? 'local' : 'remote'})...`);
  execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
