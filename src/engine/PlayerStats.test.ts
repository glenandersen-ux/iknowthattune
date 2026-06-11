import { describe, it, expect } from 'vitest';
import { computeFieldAccuracy, updateFieldStats } from './PlayerStats';
import type { PlayerSession, TrackSession } from '../types/session';

const baseTrackSession: TrackSession = {
  track_id: 'track-1',
  play_order: 1,
  clip_sequence_used: ['1s'],
  time_to_first_submit_ms: 2000,
  total_time_on_track_ms: 2000,
  submit_count: 1,
  fields_attempted: ['song_title', 'sample_source'],
  fields_correct: ['song_title'],
  fields_incorrect: ['sample_source'],
  fields_skipped: [],
  first_guess_bonus_earned: false,
  streak_position: 0,
  raw_score: 500,
  clip_penalty_applied: 0,
  speed_multiplier_applied: 1,
  guess_history: [],
};

function makeSession(tracks: TrackSession[]): PlayerSession {
  return {
    session_id: 'session-1',
    player_name: 'Glen',
    challenge_id: null,
    mode: 'solo',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 30,
    device_type: 'desktop',
    tracks,
    totals: {
      total_score: 500,
      tracks_completed: tracks.length,
      tracks_perfect: 0,
      tracks_skipped: 0,
      total_params_attempted: 2,
      total_params_correct: 1,
      total_params_incorrect: 1,
      accuracy_pct: 50,
      first_guess_bonuses_earned: 0,
      max_streak: 0,
      clips_extended: 0,
      total_clip_penalty: 0,
    },
    comparison: null,
    share: null,
  };
}

describe('updateFieldStats', () => {
  it('accumulates attempted/correct counts across sessions', () => {
    let stats = updateFieldStats({}, makeSession([baseTrackSession]));
    stats = updateFieldStats(stats, makeSession([baseTrackSession]));

    expect(stats.song_title).toEqual({ attempted: 2, correct: 2 });
    expect(stats.sample_source).toEqual({ attempted: 2, correct: 0 });
  });
});

describe('computeFieldAccuracy', () => {
  it('excludes fields below the minimum attempt threshold', () => {
    const stats = { song_title: { attempted: 2, correct: 2 } };
    const { hardest, easiest } = computeFieldAccuracy(stats);
    expect(hardest).toEqual({});
    expect(easiest).toEqual({});
  });

  it('ranks fields by accuracy once the minimum attempt threshold is met', () => {
    const stats = {
      song_title: { attempted: 10, correct: 9 },
      sample_source: { attempted: 5, correct: 1 },
    };
    const { hardest, easiest } = computeFieldAccuracy(stats);
    expect(Object.keys(hardest)[0]).toBe('sample_source');
    expect(Object.keys(easiest)[0]).toBe('song_title');
    expect(hardest.sample_source).toBeCloseTo(0.2, 5);
    expect(easiest.song_title).toBeCloseTo(0.9, 5);
  });
});
