// Enriches auto-generated seed-track entries with data from Deezer's API.
// For each auto_ track:
//   1. Searches Deezer for a matching track (title + artist)
//   2. If found, fetches the full track object to extract:
//      genre, BPM, songwriter (Author/Composer roles), producer, featured artist
//   3. Writes enriched data back to seed-tracks.json (+ public copy)
//   4. Adds metadata.deezer_track_id (found) or metadata.deezer_not_found:true
//
// Runtime: ~30 minutes for 2000 tracks. Run in background:
//   node catalog/scripts/enrich-from-deezer.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATHS = [
  path.join(__dirname, '..', 'data', 'seed-tracks.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json'),
];

const DELAY_MS = 450; // ~2.2 req/s — polite for Deezer's undocumented limit

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deezerSearch(title, artist) {
  const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0] ?? null;
  } catch { return null; }
}

async function deezerTrackDetail(id) {
  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function extractGenres(detail) {
  const genres = detail?.genres?.data?.map(g => g.name).filter(Boolean) ?? [];
  return genres.length > 0 ? genres : null;
}

function extractContributors(detail) {
  const contributors = detail?.contributors ?? [];
  const songwriters = contributors
    .filter(c => c.role === 'Author' || c.role === 'Composer')
    .map(c => c.name);
  const producers = contributors
    .filter(c => c.role === 'Producer')
    .map(c => c.name);
  return { songwriters, producers };
}

async function main() {
  const tracks = JSON.parse(readFileSync(OUT_PATHS[0], 'utf-8'));

  // Only process auto-generated tracks that haven't been enriched yet.
  const toEnrich = tracks.filter(t =>
    t.track_id.startsWith('auto_') &&
    !t.metadata.deezer_track_id &&
    !t.metadata.deezer_not_found
  );

  console.log(`Enriching ${toEnrich.length} tracks…`);
  let found = 0, notFound = 0, enriched = 0;

  for (let i = 0; i < toEnrich.length; i++) {
    const track = toEnrich[i];
    const title = track.answers.song_title.value;
    const artist = track.answers.primary_artist.value;

    // Phase 1: search
    const searchResult = await deezerSearch(title, artist);
    await sleep(DELAY_MS);

    if (!searchResult) {
      track.metadata.deezer_not_found = true;
      notFound++;
      if ((i + 1) % 100 === 0) {
        console.log(`[${i+1}/${toEnrich.length}] found:${found} notFound:${notFound} enriched:${enriched}`);
        save(tracks);
      }
      continue;
    }

    found++;
    track.metadata.deezer_track_id = searchResult.id;

    // Phase 2: full detail
    const detail = await deezerTrackDetail(searchResult.id);
    await sleep(DELAY_MS);

    if (detail) {
      // BPM
      if (detail.bpm && detail.bpm > 0 && !track.answers.bpm.value) {
        track.answers.bpm.value = Math.round(detail.bpm);
      }

      // Genre
      const genres = extractGenres(detail);
      if (genres && track.answers.genre.value.length === 0) {
        track.answers.genre.value = genres;
      }

      // Contributors
      const { songwriters, producers } = extractContributors(detail);
      if (songwriters.length > 0 && track.answers.songwriter.value.length === 0) {
        track.answers.songwriter.value = songwriters;
      }
      if (producers.length > 0 && !track.answers.producer.value) {
        track.answers.producer.value = producers[0];
      }

      // Featured artist (from explicit_content or contributors with role 'Featured')
      const featured = detail.contributors?.find(c => c.role === 'Featured')?.name ?? null;
      if (featured && !track.answers.featured_artist.value) {
        track.answers.featured_artist.value = featured;
      }

      enriched++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[${i+1}/${toEnrich.length}] found:${found} notFound:${notFound} enriched:${enriched}`);
      save(tracks);
    }
  }

  save(tracks);
  console.log(`\nDone.`);
  console.log(`Found on Deezer: ${found}/${toEnrich.length} (${Math.round(found/toEnrich.length*100)}%)`);
  console.log(`Enriched with full details: ${enriched}`);
  console.log(`Not found (audio will fall through to iTunes or show unavailable): ${notFound}`);
}

function save(tracks) {
  for (const p of OUT_PATHS) {
    writeFileSync(p, JSON.stringify(tracks, null, 2) + '\n', 'utf-8');
  }
}

main();
