import { describe, it, expect } from 'vitest';
import {
  computeSpeedMultiplier,
  computeFieldScore,
  computeFirstGuessBonus,
  computeStreakBonus,
  computeClipExtensionPenalty,
  computeTrackScore,
  computeMaxPossibleScore,
  validateResultScore,
  FIELD_DEFINITIONS,
} from './ScoringEngine';
import type { Challenge, PlayerResult } from '../types/challenge';
import type { Track } from '../types/track';

describe('computeSpeedMultiplier', () => {
  it('returns exactly 2.0 at t=0', () => {
    expect(computeSpeedMultiplier(0)).toBe(2.0);
  });

  it('returns exactly 2.0 at the t<=5 boundary', () => {
    expect(computeSpeedMultiplier(5)).toBe(2.0);
  });

  it('decays linearly from 2.0 to 1.3 between t=5 and t=15', () => {
    expect(computeSpeedMultiplier(10)).toBeCloseTo(1.65, 5);
    expect(computeSpeedMultiplier(15)).toBeCloseTo(1.3, 5);
  });

  it('decays linearly from 1.3 to 1.0 between t=15 and t=30', () => {
    expect(computeSpeedMultiplier(22.5)).toBeCloseTo(1.15, 5);
    expect(computeSpeedMultiplier(30)).toBeCloseTo(1.0, 5);
  });

  it('decays linearly from 1.0 to 0.8 between t=30 and t=60', () => {
    expect(computeSpeedMultiplier(45)).toBeCloseTo(0.9, 5);
    expect(computeSpeedMultiplier(60)).toBeCloseTo(0.8, 5);
  });

  it('returns exactly 0.5 at t=120 (floor)', () => {
    expect(computeSpeedMultiplier(120)).toBe(0.5);
  });

  it('returns the floor for any t > 60', () => {
    expect(computeSpeedMultiplier(60.001)).toBe(0.5);
  });
});

describe('computeFieldScore', () => {
  it('returns 0 for an incorrect guess', () => {
    expect(computeFieldScore('song_title', false, 1000, 0, 1)).toBe(0);
  });

  it('returns base points * difficulty weight * speed multiplier for a correct guess at t=0', () => {
    const score = computeFieldScore('song_title', true, 0, 0, 1);
    const def = FIELD_DEFINITIONS.song_title;
    expect(score).toBe(def.basePoints * def.difficultyWeight * 2.0);
  });

  it('partial credit: 3/4 correct band members yields 75% of the field score', () => {
    const fullScore = computeFieldScore('band_members', true, 0, 0, 1);
    const partialScore = computeFieldScore('band_members', true, 0, 0, 0.75);
    expect(partialScore).toBeCloseTo(fullScore * 0.75, 5);
  });

  it('returns 0 when partialRatio is 0', () => {
    expect(computeFieldScore('band_members', true, 0, 0, 0)).toBe(0);
  });
});

describe('computeFirstGuessBonus', () => {
  it('awards the flat bonus when all conditions are met', () => {
    expect(computeFirstGuessBonus(true, 0, 5)).toBe(500);
  });

  it('is not awarded if the clip was extended', () => {
    expect(computeFirstGuessBonus(true, 1, 5)).toBe(0);
  });

  it('is not awarded if not all fields were correct', () => {
    expect(computeFirstGuessBonus(false, 0, 5)).toBe(0);
  });

  it('is not awarded if submitted after 10 seconds', () => {
    expect(computeFirstGuessBonus(true, 0, 10.01)).toBe(0);
  });

  it('is awarded for a single-parameter challenge under the same conditions', () => {
    expect(computeFirstGuessBonus(true, 0, 9.99)).toBe(500);
  });
});

describe('computeStreakBonus', () => {
  it('returns 0 for streak lengths of 0 or 1', () => {
    expect(computeStreakBonus(0)).toBe(0);
    expect(computeStreakBonus(1)).toBe(0);
  });

  it('matches the DeepDive §A.8 table for streaks 2-5+', () => {
    expect(computeStreakBonus(2)).toBeCloseTo(0.1);
    expect(computeStreakBonus(3)).toBeCloseTo(0.2);
    expect(computeStreakBonus(4)).toBeCloseTo(0.35);
    expect(computeStreakBonus(5)).toBeCloseTo(0.5);
  });

  it('caps at +50% for streaks of 6 or more', () => {
    expect(computeStreakBonus(6)).toBe(0.5);
    expect(computeStreakBonus(100)).toBe(0.5);
  });
});

describe('computeClipExtensionPenalty', () => {
  it('returns 0 when no extensions occurred', () => {
    expect(computeClipExtensionPenalty(0, 1)).toBe(0);
  });

  it('returns the cumulative penalty for each extension step', () => {
    expect(computeClipExtensionPenalty(1, 1)).toBe(100);
    expect(computeClipExtensionPenalty(2, 1)).toBe(250);
    expect(computeClipExtensionPenalty(3, 1)).toBe(450);
    expect(computeClipExtensionPenalty(4, 1)).toBe(750);
  });

  it('caps at the final tier for extension counts beyond the table', () => {
    expect(computeClipExtensionPenalty(10, 1)).toBe(750);
  });

  it('scales by the remaining-fields percentage (DeepDive §A.5 edge case)', () => {
    // 2 of 4 correct before extending -> penalty = flat_penalty * 0.5
    expect(computeClipExtensionPenalty(1, 0.5)).toBe(50);
  });
});

describe('computeTrackScore', () => {
  it('sums field scores and the first guess bonus, minus the clip penalty', () => {
    expect(computeTrackScore([500, 600], 500, 100)).toBe(1500);
  });

  it('never returns a negative score (max(0, ...) wrapper)', () => {
    expect(computeTrackScore([100], 0, 1000)).toBe(0);
  });

  it('returns 0 for a skipped track', () => {
    expect(computeTrackScore([], 0, 0)).toBe(0);
  });
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    track_id: 'track-1',
    clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
    clip_start_offset_ms: 0,
    answers: {
      song_title: { value: 'Superstition', aliases: [] },
      primary_artist: { value: 'Stevie Wonder', aliases: [] },
      release_year: { value: 1972, tolerance: 2 },
      album_name: { value: 'Talking Book', aliases: [] },
      songwriter: { value: ['Stevie Wonder'], partial_credit: true },
      producer: { value: 'Stevie Wonder', aliases: [] },
      record_label: { value: 'Tamla', aliases: [] },
      genre: { value: ['Soul', 'Funk'] },
      band_members: { value: ['A', 'B', 'C', 'D'], partial_credit: true },
      featured_artist: { value: null },
      bpm: { value: 100, tolerance: 5 },
      key_signature: { value: 'Eb minor' },
      chart_peak: { value: 1, tolerance: 0 },
      sample_source: { value: null },
      certified_copies: { value: null },
      music_video_director: { value: null },
      opening_lyric: { value: 'Very superstitious', fuzzy_tolerance: 2 },
      instrument_solo: { value: ['Clavinet'] },
      covered_by: { value: ['Jeff Beck'], partial_credit: true },
      soundtrack: { value: null },
    },
    metadata: { decade: 1970, language: 'en', tags: [], difficulty_score: 2.1 },
    ...overrides,
  };
}

const baseChallenge: Challenge = {
  id: 'abc123',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: null,
  name: null,
  tracks: ['track-1'],
  active_params: { 'track-1': ['song_title', 'primary_artist'] },
  clip_starts: { 'track-1': 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 250, 450, 750], streak_multipliers: [0, 0, 0.1, 0.2, 0.35, 0.5] },
};

describe('computeMaxPossibleScore', () => {
  it('sums max field scores plus first guess bonus for a single track', () => {
    const tracks = [makeTrack()];
    const max = computeMaxPossibleScore(baseChallenge, tracks);
    const expected =
      FIELD_DEFINITIONS.song_title.basePoints * FIELD_DEFINITIONS.song_title.difficultyWeight * 2.0 +
      FIELD_DEFINITIONS.primary_artist.basePoints * FIELD_DEFINITIONS.primary_artist.difficultyWeight * 2.0 +
      500;
    expect(max).toBeCloseTo(expected, 5);
  });

  it('counts multi-value fields per accepted entry', () => {
    const challenge: Challenge = {
      ...baseChallenge,
      active_params: { 'track-1': ['band_members'] },
    };
    const tracks = [makeTrack()];
    const max = computeMaxPossibleScore(challenge, tracks);
    const def = FIELD_DEFINITIONS.band_members;
    const expected = def.basePoints * def.difficultyWeight * 2.0 * 4 + 500;
    expect(max).toBeCloseTo(expected, 5);
  });

  it('applies the streak bonus to later tracks assuming a full streak', () => {
    const challenge: Challenge = {
      ...baseChallenge,
      tracks: ['track-1', 'track-2', 'track-3'],
      active_params: {
        'track-1': ['song_title'],
        'track-2': ['song_title'],
        'track-3': ['song_title'],
      },
    };
    const tracks = [
      makeTrack({ track_id: 'track-1' }),
      makeTrack({ track_id: 'track-2' }),
      makeTrack({ track_id: 'track-3' }),
    ];
    const max = computeMaxPossibleScore(challenge, tracks);
    const def = FIELD_DEFINITIONS.song_title;
    const perTrackBase = def.basePoints * def.difficultyWeight * 2.0 + 500;
    // Track 1 (index 0): streak 0 -> no bonus. Track 3 (index 2): streak 2 -> +10%.
    const expected = perTrackBase * 1 + perTrackBase * 1 + perTrackBase * 1.1;
    expect(max).toBeCloseTo(expected, 5);
  });
});

describe('validateResultScore', () => {
  const maxPossible = 2000;

  it('accepts a score within the theoretical max', () => {
    const result: PlayerResult = { playerId: 'p1', playerName: 'Glen', score: 1900, durationSeconds: 30, clipExtensions: 0 };
    expect(validateResultScore(result, baseChallenge, maxPossible)).toBe(true);
  });

  it('accepts a score within the 5% rounding tolerance', () => {
    const result: PlayerResult = { playerId: 'p1', playerName: 'Glen', score: 2090, durationSeconds: 30, clipExtensions: 0 };
    expect(validateResultScore(result, baseChallenge, maxPossible)).toBe(true);
  });

  it('rejects a score exceeding the tolerance', () => {
    const result: PlayerResult = { playerId: 'p1', playerName: 'Glen', score: 2200, durationSeconds: 30, clipExtensions: 0 };
    expect(validateResultScore(result, baseChallenge, maxPossible)).toBe(false);
  });

  it('rejects a duration shorter than the minimum possible time', () => {
    const result: PlayerResult = { playerId: 'p1', playerName: 'Glen', score: 100, durationSeconds: 0, clipExtensions: 0 };
    expect(validateResultScore(result, baseChallenge, maxPossible)).toBe(false);
  });
});
