import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ClipDuration, Track } from '../../src/types/track';

/** One entry in `catalog/data/spotify-seed-list.json`. */
export interface SpotifySeedEntry {
  /** Our internal catalog track ID (e.g. `tk_artist_song`). */
  track_id: string;
  /** The Spotify track ID to ingest (the 22-char ID, not a URI/URL). */
  spotify_id: string;
}

/** Subset of the Spotify `GET /v1/tracks/{id}` response used here. */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; release_date: string };
  preview_url: string | null;
}

/** Subset of the Spotify `GET /v1/audio-features/{id}` response used here. */
export interface SpotifyAudioFeatures {
  tempo: number;
  /** Pitch class (0 = C, 1 = C♯/D♭, ... 11 = B), or -1 if undetected. */
  key: number;
  /** 1 = major, 0 = minor. */
  mode: number;
}

/** Pitch-class names matching `FieldMatching.DEFAULT_CHOICE_OPTIONS.key_signature` spellings. */
const PITCH_CLASS_NAMES = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B',
] as const;

/** Maps Spotify's audio-features `key`/`mode` to our `"<Note> major|minor"` key signature strings. */
export function mapKeySignature(key: number, mode: number): string | null {
  if (key < 0 || key > 11) return null;
  const note = PITCH_CLASS_NAMES[key];
  return `${note} ${mode === 1 ? 'major' : 'minor'}`;
}

/** Extracts a 4-digit year from a Spotify `release_date` (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`). */
export function parseReleaseYear(releaseDate: string): number {
  return Number.parseInt(releaseDate.slice(0, 4), 10);
}

/**
 * Builds a catalog `Track` from Spotify data. Fields Spotify cannot supply
 * (songwriter, producer, band members, niche trivia, etc.) are left null/empty
 * so the creator UI shows them as "not available" until manually curated.
 */
export function mapSpotifyTrackToTrack(
  internalId: string,
  spotifyTrack: SpotifyTrack,
  audioFeatures: SpotifyAudioFeatures | null,
  artistGenres: string[],
): Track {
  const previewUrl = spotifyTrack.preview_url ?? '';
  const clipUrls = Object.fromEntries(
    (['1s', '3s', '5s', '10s', '30s'] as ClipDuration[]).map((duration) => [duration, previewUrl]),
  ) as Record<ClipDuration, string>;

  const releaseYear = parseReleaseYear(spotifyTrack.album.release_date);

  return {
    track_id: internalId,
    clip_urls: clipUrls,
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: spotifyTrack.name, aliases: [] },
      primary_artist: { value: spotifyTrack.artists[0]?.name ?? '', aliases: [] },
      release_year: { value: releaseYear, tolerance: 2 },
      album_name: { value: spotifyTrack.album.name, aliases: [] },
      songwriter: { value: [], partial_credit: true },
      producer: { value: null, aliases: [] },
      record_label: { value: null, aliases: [] },
      genre: { value: artistGenres },
      band_members: { value: [], partial_credit: true },
      featured_artist: {
        value: spotifyTrack.artists.length > 1 ? spotifyTrack.artists.slice(1).map((a) => a.name).join(', ') : null,
      },
      bpm: { value: audioFeatures ? Math.round(audioFeatures.tempo) : null, tolerance: 5 },
      key_signature: { value: audioFeatures ? mapKeySignature(audioFeatures.key, audioFeatures.mode) : null },
      chart_peak: { value: null, tolerance: 2 },
      sample_source: { value: null },
      certified_copies: { value: null },
      music_video_director: { value: null },
      opening_lyric: { value: null, fuzzy_tolerance: 2 },
      instrument_solo: { value: null },
      covered_by: { value: [], partial_credit: true },
      soundtrack: { value: null },
    },
    metadata: {
      decade: Math.floor(releaseYear / 10) * 10,
      language: 'en',
      tags: [],
      difficulty_score: 1.0,
    },
  };
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

/** Fetches an access token via the Client Credentials flow (TechStack §D.15). */
export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Spotify API request to ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set (see catalog/scripts/.env.example).');
  }

  const dataDir = join(import.meta.dirname, '..', 'data');
  const seedListPath = join(dataDir, 'spotify-seed-list.json');
  const seedList = JSON.parse(readFileSync(seedListPath, 'utf-8')) as SpotifySeedEntry[];

  const token = await getAccessToken(clientId, clientSecret);
  const tracksDir = join(dataDir, 'tracks');
  mkdirSync(tracksDir, { recursive: true });

  for (const entry of seedList) {
    const spotifyTrack = await fetchJson<SpotifyTrack>(`/tracks/${entry.spotify_id}`, token);

    if (!spotifyTrack.preview_url) {
      console.warn(
        `  - ${entry.track_id}: no preview_url (Spotify has stopped returning preview URLs for most apps). ` +
          'clip_urls will be empty; add real clips via the BYOC uploader before this track is playable.',
      );
    }

    let audioFeatures: SpotifyAudioFeatures | null = null;
    try {
      audioFeatures = await fetchJson<SpotifyAudioFeatures>(`/audio-features/${entry.spotify_id}`, token);
    } catch {
      audioFeatures = null;
      console.warn(
        `  - ${entry.track_id}: /audio-features request failed (this endpoint requires extended API access). ` +
          'bpm and key_signature will be null and can be filled in manually.',
      );
    }

    let artistGenres: string[] = [];
    const artistId = spotifyTrack.artists[0]?.id;
    if (artistId) {
      const artist = await fetchJson<{ genres: string[] }>(`/artists/${artistId}`, token);
      artistGenres = artist.genres;
    }

    const track = mapSpotifyTrackToTrack(entry.track_id, spotifyTrack, audioFeatures, artistGenres);
    const outPath = join(tracksDir, `${entry.track_id}.json`);
    writeFileSync(outPath, JSON.stringify(track, null, 2) + '\n');
    console.log(`Wrote ${outPath}`);
  }

  console.log(`\nIngested ${seedList.length} track(s) into ${tracksDir}.`);
  console.log('Run "npm run catalog:build" to merge them into catalog/data/seed-tracks.json.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
