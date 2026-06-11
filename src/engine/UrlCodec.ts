import { z } from 'zod';
import type { Challenge, CompactResult } from '../types/challenge';

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHALLENGE_ID_LENGTH = 6;
const MAX_MINI_CHALLENGE_TRACKS = 2;

/** Generates a random 6-character base62 challenge ID (TechStack §D.10). */
export function generateChallengeId(): string {
  const bytes = new Uint8Array(CHALLENGE_ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => BASE62_CHARS[byte % BASE62_CHARS.length]).join('');
}

/** Encodes a UTF-8 string as URL-safe base64 (no `+`, `/`, or `=` padding). */
function toUrlSafeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a URL-safe base64 string back to UTF-8. Throws on malformed input. */
function fromUrlSafeBase64(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const compactResultSchema = z.object({
  u: z.string(),
  s: z.number(),
  g: z.array(z.number()),
  t: z.number(),
  p: z.number(),
});

/** Encodes a `CompactResult` for the `r` URL param (Blueprint §5). */
export function encodeResult(result: CompactResult): string {
  return toUrlSafeBase64(JSON.stringify(result));
}

/** Decodes the `r` URL param back into a `CompactResult`, or `null` if malformed. */
export function decodeResult(encoded: string): CompactResult | null {
  try {
    const parsed: unknown = JSON.parse(fromUrlSafeBase64(encoded));
    return compactResultSchema.parse(parsed);
  } catch {
    return null;
  }
}

const fieldIdSchema = z.enum([
  'song_title',
  'primary_artist',
  'release_year',
  'album_name',
  'songwriter',
  'producer',
  'record_label',
  'genre',
  'band_members',
  'featured_artist',
  'bpm',
  'key_signature',
  'chart_peak',
  'sample_source',
  'certified_copies',
  'music_video_director',
  'opening_lyric',
  'instrument_solo',
  'covered_by',
  'soundtrack',
]);

const clipStartSchema = z.enum(['hook', 'intro', 'outro']);
const timePressureSchema = z.enum(['standard', 'blitz', 'chill']);
const hintsModeSchema = z.enum(['none', 'category', 'generous']);

const challengeSchema = z.object({
  id: z.string(),
  version: z.number(),
  created_at: z.number(),
  creator_name: z.string(),
  creator_player_id: z.string(),
  creator_score: z.number().nullable(),
  name: z.string().nullable(),
  tracks: z.array(z.string()),
  active_params: z.record(z.string(), z.array(fieldIdSchema)),
  clip_starts: z.record(z.string(), clipStartSchema),
  settings: z.object({
    time_pressure: timePressureSchema,
    hints: hintsModeSchema,
    expiry_ms: z.number().nullable(),
    leaderboard_public: z.boolean(),
  }),
  scoring: z.object({
    first_guess_bonus: z.number(),
    clip_penalties: z.array(z.number()),
    streak_multipliers: z.array(z.number()),
  }),
}) satisfies z.ZodType<Challenge>;

/**
 * Encodes a full `Challenge` for the `mini` URL param, used by ≤2-track
 * challenges so they can be shared with no backend round trip (Blueprint §5).
 */
export function encodeMiniChallenge(challenge: Challenge): string {
  if (challenge.tracks.length > MAX_MINI_CHALLENGE_TRACKS) {
    throw new Error(`Mini-challenges support at most ${MAX_MINI_CHALLENGE_TRACKS} tracks`);
  }
  return toUrlSafeBase64(JSON.stringify(challenge));
}

/** Decodes the `mini` URL param back into a `Challenge`, or `null` if malformed. */
export function decodeMiniChallenge(encoded: string): Challenge | null {
  try {
    const parsed: unknown = JSON.parse(fromUrlSafeBase64(encoded));
    return challengeSchema.parse(parsed);
  } catch {
    return null;
  }
}
