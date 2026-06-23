// Maps each track's fine-grained MusicBrainz genre tags to one of 9 high-level
// genre groups and writes metadata.genre_group to seed-tracks.json.
//
// Usage: node catalog/scripts/assign-genre-groups.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATHS = [
  path.join(__dirname, '..', 'data', 'seed-tracks.json'),
  path.join(__dirname, '..', '..', 'public', 'catalog', 'data', 'seed-tracks.json'),
];

// Each entry is [group, keywords[]]. First match wins, most specific first.
const GENRE_RULES = [
  ['Jazz & Blues',        ['jazz', 'blues', 'bebop', 'swing', 'soul blues', 'chicago blues', 'delta blues', 'boogie woogie', 'ragtime', 'dixieland']],
  ['Classical',           ['classical', 'orchestra', 'opera', 'chamber music', 'choral', 'film score', 'baroque', 'minimalism', 'contemporary classical', 'neo-classical', 'neoclassical']],
  ['Latin',               ['latin', 'reggaeton', 'salsa', 'bachata', 'bossa nova', 'cumbia', 'samba', 'merengue', 'afrobeat', 'afropop', 'flamenco', 'tango']],
  ['Country',             ['country', 'outlaw country', 'americana', 'bluegrass', 'folk-country', 'western']],
  ['Hip-Hop / Rap',       ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime', 'boom bap', 'gangsta', 'conscious rap']],
  ['R&B / Soul',          ['r&b', 'soul', 'motown', 'funk', 'neo-soul', 'gospel', 'rhythm and blues', 'quiet storm', 'new jack swing', 'contemporary r&b']],
  ['Electronic / Dance',  ['electronic', 'edm', 'house', 'techno', 'drum and bass', 'dubstep', 'trance', 'ambient', 'lo-fi', 'electronica', 'breakbeat', 'jungle', 'dnb', 'idm', 'synth', 'dance', 'disco', 'garage', 'electro', 'industrial', 'noise']],
  ['Rock',                ['rock', 'alternative', 'punk', 'grunge', 'metal', 'emo', 'indie', 'shoegaze', 'post-punk', 'post-rock', 'new wave', 'prog', 'britpop', 'glam', 'psychedelic', 'hard rock', 'heavy metal', 'thrash', 'gothic']],
  ['Pop',                 ['pop', 'k-pop', 'k pop', 'kpop', 'bubblegum', 'teen pop', 'dance pop', 'electropop', 'synth-pop', 'boy band', 'girl group']],
  ['Folk',                ['folk', 'singer-songwriter', 'acoustic']],
];

function assignGroup(tags) {
  const lower = (tags ?? []).map(t => t.toLowerCase());
  for (const [group, keywords] of GENRE_RULES) {
    if (lower.some(tag => keywords.some(kw => tag.includes(kw)))) return group;
  }
  return null;
}

function main() {
  const tracks = JSON.parse(readFileSync(OUT_PATHS[0], 'utf-8'));

  let assigned = 0;
  for (const track of tracks) {
    const tags = track.answers.genre.value ?? [];
    const group = assignGroup(tags);
    if (group) {
      track.metadata.genre_group = group;
      assigned++;
    } else {
      delete track.metadata.genre_group;
    }
  }

  for (const p of OUT_PATHS) {
    writeFileSync(p, JSON.stringify(tracks, null, 2) + '\n', 'utf-8');
  }

  // Report
  const counts = {};
  for (const t of tracks) {
    const g = t.metadata.genre_group ?? '(unassigned)';
    counts[g] = (counts[g] || 0) + 1;
  }
  console.log(`Done. Assigned genre_group to ${assigned}/${tracks.length} tracks.`);
  for (const [g, n] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${g}`);
  }
}

main();
