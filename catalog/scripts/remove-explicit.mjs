// Removes song titles and albums containing explicit language from both
// catalog/data/suggestion-pool.json and catalog/data/seed-tracks.json.
// Uses whole-word matching to avoid false positives (e.g. "assassin" stays).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POOL_PATHS = [
  path.join(__dirname, '..', 'data', 'suggestion-pool.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'suggestion-pool.json'),
];
const TRACKS_PATHS = [
  path.join(__dirname, '..', 'data', 'seed-tracks.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json'),
];

// Word-boundary pattern so "assassin", "classic", "bass" etc. are not caught.
const EXPLICIT = /\b(fuck|fuckin|fucking|fucked|fucker|fucks|shit|shits|shitting|shitty|bitch|bitches|bitchin|cunt|cunts|nigga|niggas|nigger|niggers|asshole|assholes|bastard|bastards|motherfuck|motherfucker|motherfuckers|cock|cocks|pussy|pussies|faggot|faggots|whore|whores|slut|sluts|damn|goddamn|jackass|dickhead|prick|pricks|twat|twats)\b/i;

function isExplicit(text) {
  return text ? EXPLICIT.test(text) : false;
}

let removedTitles = 0, removedAlbums = 0, removedTracks = 0;

// ── suggestion-pool ──────────────────────────────────────────────────────────
for (const p of POOL_PATHS) {
  const pool = JSON.parse(readFileSync(p, 'utf-8'));
  const beforeTitles = pool.song_titles.length;
  const beforeAlbums = pool.albums.length;
  pool.song_titles = pool.song_titles.filter(t => !isExplicit(t));
  pool.albums       = pool.albums.filter(a => !isExplicit(a));
  writeFileSync(p, JSON.stringify(pool, null, 2) + '\n', 'utf-8');
  removedTitles += beforeTitles - pool.song_titles.length;
  removedAlbums += beforeAlbums - pool.albums.length;
}

// ── seed-tracks ──────────────────────────────────────────────────────────────
for (const p of TRACKS_PATHS) {
  const tracks = JSON.parse(readFileSync(p, 'utf-8'));
  const before = tracks.length;
  const cleaned = tracks.filter(t => {
    const title = t.answers?.song_title?.value ?? '';
    const album = t.answers?.album_name?.value ?? '';
    return !isExplicit(title) && !isExplicit(album);
  });
  writeFileSync(p, JSON.stringify(cleaned, null, 2) + '\n', 'utf-8');
  removedTracks += before - cleaned.length;
}

console.log(`Done.`);
console.log(`Removed ${removedTitles / 2} explicit song titles from suggestion pool`);
console.log(`Removed ${removedAlbums / 2} explicit albums from suggestion pool`);
console.log(`Removed ${removedTracks / 2} explicit tracks from playable catalog`);
