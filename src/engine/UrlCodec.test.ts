import { describe, it, expect } from 'vitest';
import { generateChallengeId, encodeResult, decodeResult, encodeMiniChallenge, decodeMiniChallenge } from './UrlCodec';
import type { Challenge, CompactResult } from '../types/challenge';

const buildChallenge = (trackCount: number): Challenge => ({
  id: 'abc123',
  version: 1,
  created_at: 1700000000000,
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: 4200,
  name: "Glen's Quiz",
  tracks: Array.from({ length: trackCount }, (_, i) => `track-${i}`),
  active_params: { 'track-0': ['song_title', 'primary_artist', 'release_year'] },
  clip_starts: { 'track-0': 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 250, 450, 750], streak_multipliers: [0.1, 0.2, 0.35, 0.5] },
});

describe('generateChallengeId', () => {
  it('returns a 6-character base62 string', () => {
    const id = generateChallengeId();
    expect(id).toHaveLength(6);
    expect(id).toMatch(/^[0-9A-Za-z]{6}$/);
  });

  it('generates different IDs across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateChallengeId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('encodeResult / decodeResult', () => {
  const result: CompactResult = { u: 'Glen', s: 7710, g: [1, 2, 0, 1], t: 95, p: 14 };

  it('round-trips a CompactResult through URL-safe base64', () => {
    const encoded = encodeResult(result);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeResult(encoded)).toEqual(result);
  });

  it('returns null for malformed input', () => {
    expect(decodeResult('not-valid-base64!!!')).toBeNull();
    expect(decodeResult('')).toBeNull();
  });

  it('returns null when decoded JSON does not match the schema', () => {
    const badPayload = btoa(JSON.stringify({ foo: 'bar' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeResult(badPayload)).toBeNull();
  });
});

describe('encodeMiniChallenge / decodeMiniChallenge', () => {
  it('round-trips a <=2-track challenge through URL-safe base64', () => {
    const challenge = buildChallenge(2);
    const encoded = encodeMiniChallenge(challenge);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeMiniChallenge(encoded)).toEqual(challenge);
  });

  it('throws when encoding a challenge with more than 2 tracks', () => {
    expect(() => encodeMiniChallenge(buildChallenge(3))).toThrow();
  });

  it('returns null for malformed input', () => {
    expect(decodeMiniChallenge('not-valid-base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON does not match the Challenge schema', () => {
    const badPayload = btoa(JSON.stringify({ id: 'abc' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeMiniChallenge(badPayload)).toBeNull();
  });
});
