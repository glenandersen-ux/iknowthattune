// Uses Spotify editorial playlists to discover the most popular songs per genre,
// verifies Deezer has a 30-second preview for each, then adds confirmed tracks
// to seed-tracks.json with genre_group set and regenerates the daily rotation.
//
// Usage:
//   node catalog/scripts/ingest-spotify-popular.mjs <SPOTIFY_CLIENT_SECRET>
//
// Your SPOTIFY_CLIENT_ID is read from wrangler.toml automatically.
// The secret is the one you stored via `wrangler secret put SPOTIFY_CLIENT_SECRET`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..', '..');
const TRACKS_PATH = path.join(__dirname, '..', 'data', 'seed-tracks.json');
const PUB_PATH    = path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json');
const ROTATION_PATHS = [
  path.join(__dirname, '..', 'data', 'daily-rotation.json'),
];

// ── Config ────────────────────────────────────────────────────────────────────

const CLIENT_SECRET = process.argv[2];
if (!CLIENT_SECRET) {
  console.error('Usage: node catalog/scripts/ingest-spotify-popular.mjs <SPOTIFY_CLIENT_SECRET>');
  process.exit(1);
}

// Read Client ID from wrangler.toml
const wrangler = readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf-8');
const CLIENT_ID = wrangler.match(/SPOTIFY_CLIENT_ID\s*=\s*"([^"]+)"/)?.[1];
if (!CLIENT_ID) {
  console.error('SPOTIFY_CLIENT_ID not found in wrangler.toml');
  process.exit(1);
}

// Editorial playlists per genre (verified per the MD specification)
const PLAYLISTS = [
  { genre_group: 'Pop',                  id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits" },
  { genre_group: 'Rock',                 id: '37i9dQZF1DXcF6B6QPhFDv', name: 'Rock This' },
  { genre_group: 'Hip-Hop / Rap',        id: '37i9dQZF1DX0XUsuxWHRQd', name: 'Rap Caviar' },
  { genre_group: 'R&B / Soul',           id: '37i9dQZF1DX4SBhb3fqCJd', name: 'R&B Vibes' },
  { genre_group: 'Electronic / Dance',   id: '37i9dQZF1DX4dyzvuaRJ0n', name: 'mint' },
  { genre_group: 'Country',              id: '37i9dQZF1DX1lVhptIYRda', name: 'Hot Country' },
  { genre_group: 'Latin',               id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino' },
  { genre_group: 'Classical',            id: '37i9dQZF1DWWEJlAGA9gs0', name: 'Classical Essentials' },
  { genre_group: 'Jazz & Blues',         id: '37i9dQZF1DXbITWG1ZJKYt', name: 'Jazz Classics' },
];

const EXPLICIT_BLOCKED = true; // remove explicit tracks
const TRACKS_PER_GENRE = 10;   // top N per genre to add to catalog
const DEEZER_DELAY_MS  = 400;

// ── Spotify auth ──────────────────────────────────────────────────────────────

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) { console.error('Spotify auth failed:', await res.text()); process.exit(1); }
  const d = await res.json();
  return d.access_token;
}

// ── Spotify playlist fetch ────────────────────────────────────────────────────

function scoreTrack(item, position) {
  let score = Math.max(0, 50 - position); // position 0 = 50 pts, position 50 = 0 pts
  const releaseDate = new Date(item.track?.album?.release_date ?? item.item?.album?.release_date ?? '2000-01-01');
  const daysSince = (Date.now() - releaseDate) / 86400000;
  if (daysSince < 90) score += 20;
  if (daysSince < 30) score += 10;
  return score;
}

async function fetchPlaylistTracks(playlistId, token) {
  // No fields filter — accept the full response and handle both "track" and
  // "item" field names since the Feb 2026 rename rolled out inconsistently.
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.log(`  Spotify error ${res.status}: ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  const rawItems = data.items ?? data.tracks?.items ?? [];
  if (rawItems.length === 0) console.log(`  Warning: 0 items returned from playlist`);
  return rawItems
    .map((entry, i) => {
      const t = entry.track ?? entry.item;
      if (!t || !t.id) return null;
      return {
        id: t.id,
        name: t.name,
        artist: t.artists?.[0]?.name ?? 'Unknown',
        album: t.album?.name ?? null,
        year: parseInt((t.album?.release_date ?? '2000').slice(0, 4), 10),
        explicit: Boolean(t.explicit),
        duration_ms: t.duration_ms ?? 0,
        score: scoreTrack(entry, i),
        position: i,
      };
    })
    .filter(Boolean)
    .filter(t => t.duration_ms > 60000)
    .filter(t => !(EXPLICIT_BLOCKED && t.explicit))
    .sort((a, b) => b.score - a.score);
}

// ── Deezer preview check ──────────────────────────────────────────────────────

async function checkDeezer(title, artist) {
  const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
    if (!res.ok) return null;
    const d = await res.json();
    const t = d.data?.[0];
    if (!t?.preview) return null;
    return { previewUrl: t.preview, trackUrl: t.link, deezerTrackId: t.id };
  } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Genre-group assignment (mirrors assign-genre-groups.mjs) ──────────────────

const GENRE_RULES = [
  ['Jazz & Blues',        ['jazz', 'blues', 'bebop', 'swing']],
  ['Classical',           ['classical', 'orchestra', 'opera', 'chamber', 'baroque']],
  ['Latin',               ['latin', 'reggaeton', 'salsa', 'bachata', 'bossa nova', 'cumbia']],
  ['Country',             ['country', 'americana', 'bluegrass']],
  ['Hip-Hop / Rap',       ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime']],
  ['R&B / Soul',          ['r&b', 'soul', 'funk', 'gospel', 'rhythm and blues']],
  ['Electronic / Dance',  ['electronic', 'edm', 'house', 'techno', 'dance', 'disco', 'synth']],
  ['Rock',                ['rock', 'alternative', 'punk', 'metal', 'indie']],
  ['Pop',                 ['pop', 'k-pop', 'bubblegum', 'dance pop']],
];

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 15);
}

function makeTrackId(artist, title, usedIds) {
  const base = `pop_${slugify(artist).slice(0,8)}_${slugify(title).slice(0,10)}`;
  let id = base; let n = 2;
  while (usedIds.has(id)) id = `${base}_${n++}`;
  return id;
}

const PLACEHOLDER_CLIP_URLS = {
  '1s': 'https://iknowthattune.com/no-catalog-clip',
  '3s': 'https://iknowthattune.com/no-catalog-clip',
  '5s': 'https://iknowthattune.com/no-catalog-clip',
  '10s': 'https://iknowthattune.com/no-catalog-clip',
  '30s': 'https://iknowthattune.com/no-catalog-clip',
};

// ── Daily rotation (reuse existing logic) ─────────────────────────────────────

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
  console.log(`Using Spotify Client ID: ${CLIENT_ID.slice(0,8)}...`);
  const token = await getSpotifyToken();
  console.log('✓ Spotify token obtained');

  const catalog = JSON.parse(readFileSync(TRACKS_PATH, 'utf-8'));
  const existingTitles = new Set(
    catalog.map(t => `${t.answers.primary_artist.value?.toLowerCase()}|${t.answers.song_title.value?.toLowerCase()}`),
  );
  const usedIds = new Set(catalog.map(t => t.track_id));

  const popularTracks = []; // tracks we're adding to catalog
  let totalAdded = 0;

  for (const playlist of PLAYLISTS) {
    console.log(`\n── ${playlist.genre_group}: ${playlist.name} ──`);
    const items = await fetchPlaylistTracks(playlist.id, token);
    console.log(`  Fetched ${items.length} eligible tracks from Spotify`);

    let addedForGenre = 0;
    for (const item of items) {
      if (addedForGenre >= TRACKS_PER_GENRE) break;

      const key = `${item.artist.toLowerCase()}|${item.name.toLowerCase()}`;
      if (existingTitles.has(key)) {
        console.log(`  [skip] "${item.name}" already in catalog`);
        continue;
      }

      // Verify Deezer has audio
      process.stdout.write(`  Checking Deezer: "${item.name}" by ${item.artist}… `);
      const deezer = await checkDeezer(item.name, item.artist);
      await sleep(DEEZER_DELAY_MS);

      if (!deezer) {
        console.log('✗ no preview');
        continue;
      }
      console.log('✓');

      const trackId = makeTrackId(item.artist, item.name, usedIds);
      usedIds.add(trackId);
      existingTitles.add(key);

      const decade = Math.floor(item.year / 10) * 10;
      const track = {
        track_id: trackId,
        clip_urls: PLACEHOLDER_CLIP_URLS,
        clip_start_offset_ms: 0,
        answers: {
          song_title:          { value: item.name,   aliases: [] },
          primary_artist:      { value: item.artist, aliases: [] },
          release_year:        { value: item.year,   tolerance: 2 },
          album_name:          { value: item.album ?? null, aliases: [] },
          songwriter:          { value: [], partial_credit: true },
          producer:            { value: null, aliases: [] },
          record_label:        { value: null, aliases: [] },
          genre:               { value: [playlist.genre_group] },
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
          tags: ['popular', 'editorial'],
          difficulty_score: 1.0,  // popular songs = easier
          genre_group: playlist.genre_group,
          deezer_track_id: deezer.deezerTrackId,
          spotify_score: item.score,
        },
      };

      catalog.push(track);
      popularTracks.push(track);
      addedForGenre++;
      totalAdded++;
      console.log(`  + Added: "${item.name}" (score ${item.score})`);
    }
    console.log(`  → ${addedForGenre} new tracks added for ${playlist.genre_group}`);
  }

  // Save updated catalog
  writeFileSync(TRACKS_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
  writeFileSync(PUB_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
  console.log(`\n✓ Saved catalog: ${catalog.length} total tracks (+${totalAdded} new)`);

  // Regenerate daily rotation prioritising popular tracks at the front
  const JUNK  = /\b(ringtone|karaoke|instrumental|medley|interlude)\b/i;
  const NON_ASCII = /[^\x00-\x7F]/;
  const BAD_ARTIST = new Set(['various artists', 'unknown artist', '']);

  const eligible = catalog.filter(t => {
    const artist = (t.answers.primary_artist.value ?? '').trim();
    const title  = (t.answers.song_title.value ?? '').trim();
    return !BAD_ARTIST.has(artist.toLowerCase()) && !JUNK.test(title) && !NON_ASCII.test(title) && !NON_ASCII.test(artist);
  });

  // Tier 1: newly added popular tracks (Deezer confirmed, high editorial score)
  const tier1 = eligible.filter(t => t.metadata.spotify_score !== undefined && t.metadata.deezer_track_id);
  // Tier 2: existing confirmed Deezer tracks
  const tier2 = eligible.filter(t => !t.metadata.spotify_score && t.metadata.deezer_track_id);
  // Tier 3: unverified
  const tier3 = eligible.filter(t => !t.metadata.deezer_track_id);

  // Sort tier1 by spotify_score descending so highest-scoring songs fill the front days
  const sortedTier1 = [...tier1].sort((a, b) => (b.metadata.spotify_score ?? 0) - (a.metadata.spotify_score ?? 0));
  const shuffledTier2 = seededShuffle(tier2.map(t => t.track_id));
  const shuffledTier3 = seededShuffle(tier3.map(t => t.track_id), 99);

  const allIds = [...sortedTier1.map(t => t.track_id), ...shuffledTier2, ...shuffledTier3];

  const today = new Date().toISOString().slice(0, 10);
  const rotation = Array.from({ length: 365 }, (_, i) => ({
    key: `daily:${dateAddDays(today, i)}`,
    value: allIds[i % allIds.length],
  }));

  for (const p of ROTATION_PATHS) {
    writeFileSync(p, JSON.stringify(rotation, null, 2) + '\n', 'utf-8');
  }

  console.log(`\n✓ Daily rotation regenerated.`);
  console.log(`  Tier 1 (popular + Deezer confirmed): ${tier1.length} tracks → assigned to first ${Math.min(tier1.length, 365)} days`);
  console.log(`  Tier 2 (existing + Deezer confirmed): ${tier2.length} tracks`);
  console.log(`  Tier 3 (unverified): ${tier3.length} tracks`);

  console.log(`\nNext step — upload rotation to KV:`);
  console.log(`  node catalog/scripts/upload-daily-rotation.mjs <CF_API_TOKEN>`);
}

main();
