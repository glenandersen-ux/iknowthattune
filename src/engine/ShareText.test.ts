import { describe, it, expect } from 'vitest';
import { buildEmojiGrid } from './ShareText';
import type { PlayerSession, TrackSession } from '../types/session';

const buildTrack = (correct: number, total: number): TrackSession => ({
  track_id: 't',
  play_order: 1,
  clip_sequence_used: ['1s'],
  time_to_first_submit_ms: 1000,
  total_time_on_track_ms: 1000,
  submit_count: 1,
  fields_attempted: Array.from({ length: total }, (_, i) => `field_${i}` as never),
  fields_correct: Array.from({ length: correct }, (_, i) => `field_${i}` as never),
  fields_incorrect: [],
  fields_skipped: [],
  first_guess_bonus_earned: false,
  streak_position: 0,
  raw_score: 1000,
  clip_penalty_applied: 0,
  speed_multiplier_applied: 1,
  guess_history: [],
});

const baseSession = (tracks: TrackSession[], comparison: PlayerSession['comparison'] = null): PlayerSession => ({
  session_id: 's1',
  player_name: 'Glen',
  challenge_id: null,
  mode: 'solo',
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  duration_seconds: 60,
  device_type: 'desktop',
  tracks,
  totals: {
    total_score: 8600,
    tracks_completed: tracks.length,
    tracks_perfect: 0,
    tracks_skipped: 0,
    total_params_attempted: 0,
    total_params_correct: 0,
    total_params_incorrect: 0,
    accuracy_pct: 0,
    first_guess_bonuses_earned: 0,
    max_streak: 0,
    clips_extended: 0,
    total_clip_penalty: 0,
  },
  comparison,
  share: null,
});

describe('buildEmojiGrid', () => {
  it('renders one row per track with correct/incorrect squares and the total score', () => {
    const session = baseSession([buildTrack(4, 4), buildTrack(3, 4)]);
    const text = buildEmojiGrid(session, "Glen's 70s Soul Quiz");

    expect(text).toContain("🎵 I Know That Tune — Glen's 70s Soul Quiz");
    expect(text).toContain('✅✅✅✅ | ✅✅✅❌');
    expect(text).toContain('Score: 8,600');
  });

  it('appends a win line when the session has a winning comparison', () => {
    const session = baseSession([buildTrack(4, 4)], {
      challenger_name: 'Glen',
      challenger_score: 7710,
      result: 'win',
      margin: 890,
    });
    const text = buildEmojiGrid(session, 'Test Challenge');
    expect(text).toContain('Beat Glen by 890 pts 🏆');
  });

  it('appends a loss line when the session has a losing comparison', () => {
    const session = baseSession([buildTrack(4, 4)], {
      challenger_name: 'Glen',
      challenger_score: 9000,
      result: 'loss',
      margin: -400,
    });
    const text = buildEmojiGrid(session, 'Test Challenge');
    expect(text).toContain('Lost to Glen by 400 pts');
  });

  it('omits comparison lines when there is no comparison', () => {
    const session = baseSession([buildTrack(4, 4)]);
    const text = buildEmojiGrid(session, 'Test Challenge');
    expect(text.split('\n')).toHaveLength(3);
  });
});
