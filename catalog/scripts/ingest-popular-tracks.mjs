// Discovers the most-played songs per genre using Last.fm's tag.getTopTracks
// API, verifies each has a 30-second Deezer preview, fetches album + release
// year from Deezer, then adds confirmed tracks to seed-tracks.json and
// regenerates the daily rotation with popular tracks at the front.
//
// Usage:
//   node catalog/scripts/ingest-popular-tracks.mjs <LASTFM_API_KEY>
//
// Get a free API key at https://www.last.fm/api/account/create
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKS_PATH = path.join(__dirname, '..', 'data', 'seed-tracks.json');
const PUB_PATH    = path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json');
const ROT_PATH    = path.join(__dirname, '..', 'data', 'daily-rotation.json');

const LASTFM_KEY = process.argv[2];
if (!LASTFM_KEY) {
  console.error('Usage: node catalog/scripts/ingest-popular-tracks.mjs <LASTFM_API_KEY>');
  process.exit(1);
}

// Last.fm genre tags → our 9 high-level groups.
// Multiple tags per group increases coverage when the primary tag has gaps.
const GENRES = [
  { genre_group: 'Pop',               tags: ['pop', 'dance pop'] },
  { genre_group: 'Rock',              tags: ['rock', 'classic rock'] },
  { genre_group: 'Hip-Hop / Rap',     tags: ['hip-hop', 'rap'] },
  { genre_group: 'R&B / Soul',        tags: ['rnb', 'soul'] },
  { genre_group: 'Electronic / Dance',tags: ['electronic', 'house'] },
  { genre_group: 'Country',           tags: ['country'] },
  { genre_group: 'Latin',             tags: ['latin'] },
  { genre_group: 'Classical',         tags: ['classical'] },
  { genre_group: 'Jazz & Blues',      tags: ['jazz', 'blues'] },
];

const TRACKS_PER_GENRE = 10;
const EXPLICIT_WORDS = /\b(fuck|shit|bitch|nigga|nigger|cunt|asshole|motherfuck)\b/i;
const DELAY_MS = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Last.fm ───────────────────────────────────────────────────────────────────

async function lastfmTopTracks(tag, limit = 50) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=tag.getTopTracks&tag=${encodeURIComponent(tag)}&limit=${limit}&api_key=${LASTFM_KEY}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks?.track ?? []).map((t, i) => ({
      name: t.name,
      artist: t.artist?.name ?? t.artist,
      rank: i + 1,
    }));
  } catch { return []; }
}

// ── Deezer ────────────────────────────────────────────────────────────────────

async function deezerSearch(title, artist) {
  // Strip parenthetical suffixes for better matching (e.g. "Song (feat. X)")
  const baseTitle = title.replace(/\s*[\[(][^\])]*[\])]/g, '').trim();
  for (const t of [title, baseTitle]) {
    const q = encodeURIComponent(`artist:"${artist}" track:"${t}"`);
    try {
      const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
      if (!res.ok) continue;
      const d = await res.json();
      const track = d.data?.[0];
      if (track?.preview) return track;
    } catch { /* try next */ }
  }
  return null;
}

async function deezerTrackDetails(id) {
  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 15);
}

function makeTrackId(artist, title, usedIds) {
  const base = `pop_${slugify(artist).slice(0, 8)}_${slugify(title).slice(0, 10)}`;
  let id = base; let n = 2;
  while (usedIds.has(id)) id = `${base}_${n++}`;
  return id;
}

const PLACEHOLDER_URLS = {
  '1s': 'https://iknowthattune.com/no-catalog-clip',
  '3s': 'https://iknowthattune.com/no-catalog-clip',
  '5s': 'https://iknowthattune.com/no-catalog-clip',
  '10s': 'https://iknowthattune.com/no-catalog-clip',
  '30s': 'https://iknowthattune.com/no-catalog-clip',
};

function seededShuffle(arr, seed = 42) {
  const result = [...arr]; let s = seed;
  const next = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const catalog = JSON.parse(readFileSync(TRACKS_PATH, 'utf-8'));
  const existingKeys = new Set(
    catalog.map(t => `${t.answers.primary_artist.value?.toLowerCase()}|${t.answers.song_title.value?.toLowerCase()}`),
  );
  const usedIds = new Set(catalog.map(t => t.track_id));

  let totalAdded = 0;

  for (const { genre_group, tags } of GENRES) {
    console.log(`\n── ${genre_group} ──`);

    // Fetch from multiple tags and merge, deduped by "artist|track"
    const seen = new Set();
    const candidates = [];
    for (const tag of tags) {
      const tracks = await lastfmTopTracks(tag);
      await sleep(DELAY_MS);
      for (const t of tracks) {
        const key = `${t.artist.toLowerCase()}|${t.name.toLowerCase()}`;
        if (!seen.has(key)) { seen.add(key); candidates.push(t); }
      }
    }
    console.log(`  ${candidates.length} candidates from Last.fm`);

    let addedForGenre = 0;

    for (const candidate of candidates) {
      if (addedForGenre >= TRACKS_PER_GENRE) break;

      const key = `${candidate.artist.toLowerCase()}|${candidate.name.toLowerCase()}`;
      if (existingKeys.has(key)) continue;
      if (EXPLICIT_WORDS.test(candidate.name) || EXPLICIT_WORDS.test(candidate.artist)) continue;

      // Check Deezer for audio + basic info
      process.stdout.write(`  [${candidate.rank}] "${candidate.name}" – ${candidate.artist} … `);
      const deezerResult = await deezerSearch(candidate.name, candidate.artist);
      await sleep(DELAY_MS);

      if (!deezerResult) { console.log('✗ no Deezer preview'); continue; }

      // Fetch full track details for release year
      const details = await deezerTrackDetails(deezerResult.id);
      await sleep(DELAY_MS);

      const releaseDate = details?.release_date ?? deezerResult.album?.release_date ?? null;
      const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
      const album = deezerResult.album?.title ?? null;

      console.log(`✓ (${year ?? '?'})`);

      const trackId = makeTrackId(candidate.artist, candidate.name, usedIds);
      usedIds.add(trackId);
      existingKeys.add(key);

      catalog.push({
        track_id: trackId,
        clip_urls: PLACEHOLDER_URLS,
        clip_start_offset_ms: 0,
        answers: {
          song_title:           { value: candidate.name, aliases: [] },
          primary_artist:       { value: candidate.artist, aliases: [] },
          release_year:         { value: year, tolerance: 2 },
          album_name:           { value: album, aliases: [] },
          songwriter:           { value: [], partial_credit: true },
          producer:             { value: null, aliases: [] },
          record_label:         { value: null, aliases: [] },
          genre:                { value: [genre_group] },
          band_members:         { value: [], partial_credit: true },
          featured_artist:      { value: null },
          bpm:                  { value: null, tolerance: 5 },
          key_signature:        { value: null },
          chart_peak:           { value: null, tolerance: 2 },
          sample_source:        { value: null },
          certified_copies:     { value: null },
          music_video_director: { value: null },
          opening_lyric:        { value: null, fuzzy_tolerance: 2 },
          instrument_solo:      { value: null },
          covered_by:           { value: [], partial_credit: true },
          soundtrack:           { value: null },
        },
        metadata: {
          decade: year ? Math.floor(year / 10) * 10 : 2020,
          language: 'en',
          tags: ['popular', 'lastfm-editorial'],
          difficulty_score: 1.0,
          genre_group,
          deezer_track_id: deezerResult.id,
        },
      });

      addedForGenre++;
      totalAdded++;
    }
    console.log(`  → ${addedForGenre} tracks added`);
  }

  // Save catalog
  for (const p of [TRACKS_PATH, PUB_PATH]) {
    writeFileSync(p, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
  }
  console.log(`\n✓ Catalog saved: ${catalog.length} total tracks (+${totalAdded} popular)`);

  // Regenerate daily rotation — popular tracks (Deezer confirmed, last.fm sourced) go first
  const JUNK = /\b(ringtone|karaoke|instrumental|medley|interlude)\b/i;
  const NON_ASCII = /[^\x00-\x7F]/;
  const BAD = new Set(['various artists', 'unknown artist', '']);

  const eligible = catalog.filter(t => {
    const a = (t.answers.primary_artist.value ?? '').trim();
    const ti = (t.answers.song_title.value ?? '').trim();
    return !BAD.has(a.toLowerCase()) && !JUNK.test(ti) && !NON_ASCII.test(ti) && !NON_ASCII.test(a);
  });

  const popular  = seededShuffle(eligible.filter(t => t.metadata.tags?.includes('lastfm-editorial') && t.metadata.deezer_track_id).map(t => t.track_id));
  const confirmed = seededShuffle(eligible.filter(t => !t.metadata.tags?.includes('lastfm-editorial') && t.metadata.deezer_track_id).map(t => t.track_id));
  const rest      = seededShuffle(eligible.filter(t => !t.metadata.deezer_track_id).map(t => t.track_id), 99);

  const allIds = [...popular, ...confirmed, ...rest];
  const today = new Date().toISOString().slice(0, 10);
  const rotation = Array.from({ length: 365 }, (_, i) => ({
    key: `daily:${dateAddDays(today, i)}`,
    value: allIds[i % allIds.length],
  }));

  writeFileSync(ROT_PATH, JSON.stringify(rotation, null, 2) + '\n', 'utf-8');

  console.log(`✓ Daily rotation regenerated.`);
  console.log(`  Popular (Last.fm + Deezer): ${popular.length}`);
  console.log(`  Other confirmed Deezer: ${confirmed.length}`);
  console.log(`  Unverified: ${rest.length}`);
  console.log(`\nNext: git add/commit/push, then upload rotation:`);
  console.log(`  node catalog/scripts/upload-daily-rotation.mjs <CF_API_TOKEN>`);
}

main();
