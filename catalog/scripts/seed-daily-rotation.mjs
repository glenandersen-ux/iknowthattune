// Generates a year's worth of daily drop assignments and uploads them to
// Cloudflare KV in a single wrangler bulk-put operation.
//
// Usage (two steps):
//   node catalog/scripts/seed-daily-rotation.mjs          # generates the JSON
//   npx wrangler kv bulk put catalog/data/daily-rotation.json --binding CHALLENGES_KV
//
// Re-run after enrich-from-deezer.mjs completes to prioritise confirmed tracks.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'seed-tracks.json');
const OUT_PATH     = path.join(__dirname, '..', 'data', 'daily-rotation.json');

const DAYS_AHEAD = 365;

function seededShuffle(arr, seed = 42) {
  const result = [...arr];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dateAddDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));

  const JUNK_TITLE  = /\b(ringtone|ring tone|karaoke|instrumental|medley|skit|interlude|reprise|bonus)\b/i;
  const JUNK_ARTIST = new Set(['various artists', 'unknown artist', 'unknown', '']);
  const NON_ASCII   = /[^\x00-\x7F]/;
  const REPEATED_SPECIAL = /[^a-z0-9 '",.()\-!&]{3,}/i;

  const eligible = catalog.filter(t => {
    const artist = (t.answers.primary_artist.value ?? '').trim();
    const title  = (t.answers.song_title.value ?? '').trim();
    if (JUNK_ARTIST.has(artist.toLowerCase())) return false;
    if (JUNK_TITLE.test(title)) return false;
    if (REPEATED_SPECIAL.test(title) || REPEATED_SPECIAL.test(artist)) return false;
    if (NON_ASCII.test(title) || NON_ASCII.test(artist)) return false;
    if (title.length < 2 || artist.length < 2) return false;
    return true;
  });

  // Tier 1: confirmed on Deezer (enrichment found them)
  // Tier 2: not yet checked or not found — used only to fill remaining days
  const confirmed = eligible.filter(t => t.metadata.deezer_track_id);
  const unverified = eligible.filter(t => !t.metadata.deezer_track_id && !t.metadata.deezer_not_found);

  console.log(`Eligible: ${eligible.length} | Confirmed Deezer: ${confirmed.length} | Unverified: ${unverified.length}`);

  const priorityIds  = seededShuffle(confirmed.map(t => t.track_id));
  const fallbackIds  = seededShuffle(unverified.map(t => t.track_id), 99);
  const cycleIds = [...priorityIds, ...fallbackIds];

  const today = new Date().toISOString().slice(0, 10);
  const kvEntries = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date    = dateAddDays(today, i);
    const trackId = cycleIds[i % cycleIds.length];
    kvEntries.push({ key: `daily:${date}`, value: trackId });
  }

  writeFileSync(OUT_PATH, JSON.stringify(kvEntries, null, 2) + '\n', 'utf-8');

  console.log(`Generated ${kvEntries.length} daily drop assignments.`);
  console.log(`Date range: ${kvEntries[0].key.replace('daily:','')} to ${kvEntries[kvEntries.length-1].key.replace('daily:','')}`);
  console.log(`\nTo upload to Cloudflare KV, run:`);
  console.log(`  npx wrangler kv bulk put catalog/data/daily-rotation.json --binding CHALLENGES_KV`);
  console.log(`\nSample schedule:`);
  for (const e of kvEntries.slice(0, 7)) {
    const track  = catalog.find(t => t.track_id === e.value);
    const title  = track?.answers.song_title.value ?? e.value;
    const artist = track?.answers.primary_artist.value ?? '';
    const audio  = track?.metadata.deezer_track_id ? '✓' : '?';
    console.log(`  ${e.key.replace('daily:','')}  ${audio} ${artist} — ${title}`);
  }
}

main();
