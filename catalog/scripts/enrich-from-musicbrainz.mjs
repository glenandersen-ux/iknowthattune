// Enriches seed-tracks.json with genre and songwriter data from MusicBrainz.
//
// Phase 1 (fast, ~13 min): artist genre lookup
//   One request per unique artist → applies top genre tags to all that
//   artist's tracks that currently have no genre data.
//
// Phase 2 (slow, optional): recording → work → songwriter lookup
//   Two requests per track → populates songwriter field.
//   Only runs when --songwriters flag is passed, and only for tracks
//   that have a confirmed Deezer track ID (confirmed audio, likely popular).
//
// Usage:
//   node catalog/scripts/enrich-from-musicbrainz.mjs             # genres only
//   node catalog/scripts/enrich-from-musicbrainz.mjs --songwriters
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATHS = [
  path.join(__dirname, '..', 'data', 'seed-tracks.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json'),
];

const DELAY_MS = 1100;
const UA = 'IKnowThatTune/1.0 (https://iknowthattune.com)';
const SONGWRITER_FLAG = process.argv.includes('--songwriters');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mbGet(path) {
  const res = await fetch(`https://musicbrainz.org/ws/2${path}&fmt=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Phase 1: genre via artist lookup ──────────────────────────────────────────

async function fetchArtistGenres(artistName) {
  const q = encodeURIComponent(`artist:"${artistName}"`);
  const data = await mbGet(`/artist?query=${q}&limit=1`);
  const artist = data?.artists?.[0];
  if (!artist) return [];
  // Tags are user-contributed genre labels sorted by vote count descending.
  const tags = (artist.tags ?? [])
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 4)
    .map(t => t.name)
    .filter(Boolean)
    // Capitalise first letter of each word to match existing genre style.
    .map(g => g.replace(/\b\w/g, c => c.toUpperCase()));
  return tags;
}

// ── Phase 2: songwriter via recording → work lookup ───────────────────────────

async function fetchRecordingMbid(title, artist) {
  const q = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
  const data = await mbGet(`/recording?query=${q}&limit=1`);
  return data?.recordings?.[0]?.id ?? null;
}

async function fetchSongwriters(mbid) {
  const data = await mbGet(`/recording/${mbid}?inc=work-rels`);
  const workRels = data?.relations?.filter(r => r['target-type'] === 'work') ?? [];
  if (workRels.length === 0) return [];

  const workId = workRels[0]?.work?.id;
  if (!workId) return [];

  const workData = await mbGet(`/work/${workId}?inc=artist-rels`);
  const writers = (workData?.relations ?? [])
    .filter(r => ['composer', 'lyricist', 'writer'].includes(r.type))
    .map(r => r.artist?.name)
    .filter(Boolean);
  return [...new Set(writers)];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const tracks = JSON.parse(readFileSync(OUT_PATHS[0], 'utf-8'));

  // ── Phase 1: genres ────────────────────────────────────────────────────────
  const artistsNeedingGenres = new Set(
    tracks
      .filter(t => {
        const g = t.answers.genre.value;
        return (!Array.isArray(g) || g.length === 0);
      })
      .map(t => t.answers.primary_artist.value)
      .filter(Boolean),
  );

  console.log(`Phase 1: looking up genres for ${artistsNeedingGenres.size} artists…`);
  const artistGenreCache = new Map();
  let artistsDone = 0;
  let genresAdded = 0;

  for (const artist of artistsNeedingGenres) {
    const genres = await fetchArtistGenres(artist);
    artistGenreCache.set(artist, genres);
    artistsDone++;
    await sleep(DELAY_MS);
    if (artistsDone % 50 === 0) {
      console.log(`  [${artistsDone}/${artistsNeedingGenres.size}] genres cached`);
      save(tracks);
    }
  }

  // Apply cached genres to tracks.
  for (const track of tracks) {
    const g = track.answers.genre.value;
    if (Array.isArray(g) && g.length > 0) continue; // already has genre
    const artist = track.answers.primary_artist.value;
    const genres = artistGenreCache.get(artist) ?? [];
    if (genres.length > 0) {
      track.answers.genre.value = genres;
      genresAdded++;
    }
  }
  save(tracks);
  console.log(`Phase 1 done. Genre data added to ${genresAdded} tracks.`);

  if (!SONGWRITER_FLAG) {
    console.log('\nSkipping songwriter lookup (no --songwriters flag).');
    return;
  }

  // ── Phase 2: songwriters (confirmed-Deezer tracks only) ────────────────────
  const needSongwriters = tracks.filter(t =>
    t.metadata.deezer_track_id &&
    Array.isArray(t.answers.songwriter.value) &&
    t.answers.songwriter.value.length === 0,
  );

  console.log(`\nPhase 2: songwriter lookup for ${needSongwriters.length} confirmed tracks…`);
  let swDone = 0;
  let swAdded = 0;

  for (const track of needSongwriters) {
    const title  = track.answers.song_title.value;
    const artist = track.answers.primary_artist.value;

    const mbid = await fetchRecordingMbid(title, artist);
    await sleep(DELAY_MS);
    if (!mbid) { swDone++; continue; }

    const writers = await fetchSongwriters(mbid);
    await sleep(DELAY_MS);
    if (writers.length > 0) {
      track.answers.songwriter.value = writers;
      swAdded++;
    }

    swDone++;
    if (swDone % 100 === 0) {
      console.log(`  [${swDone}/${needSongwriters.length}] +${swAdded} songwriter entries`);
      save(tracks);
    }
  }

  save(tracks);
  console.log(`Phase 2 done. Songwriter data added to ${swAdded} tracks.`);
}

function save(tracks) {
  for (const p of OUT_PATHS) {
    writeFileSync(p, JSON.stringify(tracks, null, 2) + '\n', 'utf-8');
  }
}

main();
