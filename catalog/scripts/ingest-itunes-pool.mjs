// Expands catalog/data/suggestion-pool.json (and the public copy) with song
// titles, artists, and albums pulled from the free iTunes Search API — the
// same no-auth API already used for the in-game preview fallback. Only
// metadata (titles/names) is fetched and stored; no audio is downloaded.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POOL_PATHS = [
  path.join(__dirname, '..', 'data', 'suggestion-pool.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'suggestion-pool.json'),
];

const REQUEST_DELAY_MS = 250;
const RESULTS_PER_ARTIST = 50;

// Results whose title matches any of these are excluded — iTunes search
// returns a lot of karaoke/tribute/cover-band noise for popular songs.
const JUNK_TITLE_PATTERNS = [
  /karaoke/i,
  /tribute/i,
  /made famous by/i,
  /in the style of/i,
  /\bcover\b/i,
  /instrumental version/i,
  /originally performed/i,
];

function isJunkTitle(title) {
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArtistTracks(artist) {
  const params = new URLSearchParams({
    term: artist,
    media: 'music',
    entity: 'song',
    attribute: 'artistTerm',
    limit: String(RESULTS_PER_ARTIST),
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.results ?? [];
}

async function main() {
  const pool = JSON.parse(readFileSync(POOL_PATHS[0], 'utf-8'));
  const songTitles = new Set(pool.song_titles);
  const artists = new Set(pool.artists);
  const albums = new Set(pool.albums);
  const seedArtists = [...pool.artists];

  let newSongs = 0;
  let newArtists = 0;
  let newAlbums = 0;

  for (let i = 0; i < seedArtists.length; i++) {
    const artist = seedArtists[i];
    try {
      const results = await fetchArtistTracks(artist);
      for (const r of results) {
        const title = r.trackName?.trim();
        const artistName = r.artistName?.trim();
        const albumName = r.collectionName?.trim();

        if (title && !isJunkTitle(title) && !songTitles.has(title)) {
          songTitles.add(title);
          newSongs++;
        }
        if (artistName && !artists.has(artistName)) {
          artists.add(artistName);
          newArtists++;
        }
        if (albumName && !isJunkTitle(albumName) && !albums.has(albumName)) {
          albums.add(albumName);
          newAlbums++;
        }
      }
    } catch {
      // Skip artists that fail (network blip, etc.) — not worth retrying.
    }

    if ((i + 1) % 25 === 0) {
      console.log(`[${i + 1}/${seedArtists.length}] +${newSongs} songs, +${newArtists} artists, +${newAlbums} albums so far`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const result = {
    song_titles: [...songTitles].sort((a, b) => a.localeCompare(b)),
    artists: [...artists].sort((a, b) => a.localeCompare(b)),
    albums: [...albums].sort((a, b) => a.localeCompare(b)),
  };

  for (const poolPath of POOL_PATHS) {
    writeFileSync(poolPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  }

  console.log('Done.');
  console.log(`song_titles: ${pool.song_titles.length} -> ${result.song_titles.length} (+${newSongs})`);
  console.log(`artists: ${pool.artists.length} -> ${result.artists.length} (+${newArtists})`);
  console.log(`albums: ${pool.albums.length} -> ${result.albums.length} (+${newAlbums})`);
}

main();
