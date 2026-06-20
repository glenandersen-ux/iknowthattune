// Generates seed-tracks.json entries from catalog/data/song-metadata.json.
// Each entry gets the four Tier-1 answer fields (title, artist, year, album)
// pre-filled; all other trivia fields default to null and can be enriched
// later. Audio is served by Deezer on demand — no clip URLs are needed.
//
// Usage:  node catalog/scripts/generate-catalog.mjs
// Output: catalog/data/seed-tracks.json  (and the public/ copy)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_PATH   = path.join(__dirname, '..', 'data', 'song-metadata.json');
const POOL_PATH   = path.join(__dirname, '..', 'data', 'suggestion-pool.json');
const OUT_PATHS   = [
  path.join(__dirname, '..', 'data', 'seed-tracks.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json'),
];

const MAX_PER_ARTIST = 15;    // variety cap per artist
const TOTAL_CAP      = 9981; // total auto-generated tracks (target: 10K with 19 hand-curated)

const JUNK = /\b(live|demo|remix|karaoke|instrumental|acoustic|remaster|session|edit|mix|deluxe|bonus|rehearsal|medley|snippet|interlude|skit|reprise|cover|tribute)\b/i;

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 15);
}

function makeTrackId(artist, title, usedIds) {
  const base = `auto_${slugify(artist).slice(0, 8)}_${slugify(title).slice(0, 10)}`;
  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}_${n++}`;
  }
  return id;
}

// Placeholder URL — will 404, triggering the Deezer fallback in ClipPlayer.
// All 5 durations point to the same URL so AudioEngine deduplicates the fetch.
const PLACEHOLDER_CLIP_URLS = {
  '1s':  'https://iknowthattune.com/no-catalog-clip',
  '3s':  'https://iknowthattune.com/no-catalog-clip',
  '5s':  'https://iknowthattune.com/no-catalog-clip',
  '10s': 'https://iknowthattune.com/no-catalog-clip',
  '30s': 'https://iknowthattune.com/no-catalog-clip',
};

function makeTrack(entry, trackId) {
  const decade = Math.floor(entry.year / 10) * 10;
  return {
    track_id: trackId,
    clip_urls: PLACEHOLDER_CLIP_URLS,
    clip_start_offset_ms: 0,
    answers: {
      song_title:          { value: entry.title,  aliases: [] },
      primary_artist:      { value: entry.artist, aliases: [] },
      release_year:        { value: entry.year,   tolerance: 2 },
      album_name:          { value: entry.album ?? null, aliases: [] },
      songwriter:          { value: [], partial_credit: true },
      producer:            { value: null, aliases: [] },
      record_label:        { value: null, aliases: [] },
      genre:               { value: [] },
      band_members:        { value: [], partial_credit: true },
      featured_artist:     { value: null },
      bpm:                 { value: null, tolerance: 5 },
      key_signature:       { value: null },
      chart_peak:          { value: null, tolerance: 2 },
      sample_source:       { value: null },
      certified_copies:    { value: null },
      music_video_director:{ value: null },
      opening_lyric:       { value: null, fuzzy_tolerance: 2 },
      instrument_solo:     { value: null },
      covered_by:          { value: [], partial_credit: true },
      soundtrack:          { value: null },
    },
    metadata: {
      decade,
      language: 'en',
      tags: [],
      difficulty_score: 1.5,
    },
  };
}

function main() {
  const meta       = JSON.parse(readFileSync(META_PATH, 'utf-8'));
  const pool       = JSON.parse(readFileSync(POOL_PATH, 'utf-8'));
  const allExisting = JSON.parse(readFileSync(OUT_PATHS[0], 'utf-8'));

  // Keep hand-curated tracks (those without the auto_ prefix) and rebuild
  // the auto-generated set from scratch so we can expand the cap cleanly.
  const handCurated = allExisting.filter(t => !t.track_id.startsWith('auto_'));

  const artistSet      = new Set(pool.artists.map(a => a.toLowerCase()));
  const existingTitles = new Set(
    handCurated.map(t => t.answers.song_title.value?.toLowerCase()).filter(Boolean),
  );
  const usedIds = new Set(handCurated.map(t => t.track_id));
  const existing = handCurated;

  // Filter metadata to candidates
  const candidates = meta.filter(e =>
    e.year >= 1950 &&
    e.year <= 2025 &&
    e.title?.trim() &&
    e.artist?.trim() &&
    artistSet.has(e.artist.toLowerCase()) &&
    !JUNK.test(e.title) &&
    !JUNK.test(e.album || '') &&
    !existingTitles.has(e.title.toLowerCase()),
  );

  // Cap per artist for variety
  const countPerArtist = new Map();
  const selected = [];
  for (const entry of candidates) {
    const key = entry.artist.toLowerCase();
    const count = countPerArtist.get(key) ?? 0;
    if (count >= MAX_PER_ARTIST) continue;
    countPerArtist.set(key, count + 1);
    selected.push(entry);
    if (selected.length >= TOTAL_CAP) break;
  }

  // Build track records
  const newTracks = selected.map(entry => {
    const trackId = makeTrackId(entry.artist, entry.title, usedIds);
    usedIds.add(trackId);
    return makeTrack(entry, trackId);
  });

  const combined = [...existing, ...newTracks];

  for (const outPath of OUT_PATHS) {
    writeFileSync(outPath, JSON.stringify(combined, null, 2) + '\n', 'utf-8');
  }

  console.log(`Done. ${existing.length} existing + ${newTracks.length} new = ${combined.length} total tracks.`);
  const artistsRepresented = new Set(newTracks.map(t => t.answers.primary_artist.value));
  console.log(`Artists represented: ${artistsRepresented.size}`);
  console.log(`Sample new tracks:`);
  for (const t of newTracks.slice(0, 6)) {
    console.log(`  ${t.answers.primary_artist.value} — ${t.answers.song_title.value} (${t.answers.release_year.value})`);
  }
}

main();
