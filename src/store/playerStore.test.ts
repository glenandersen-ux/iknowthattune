import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from './playerStore';
import type { PlayerSession } from '../types/session';

function makeSession(overrides: Partial<PlayerSession> = {}): PlayerSession {
  return {
    session_id: 'session-1',
    player_name: 'Glen',
    challenge_id: null,
    mode: 'solo',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 120,
    device_type: 'desktop',
    tracks: [],
    totals: {
      total_score: 1000,
      tracks_completed: 5,
      tracks_perfect: 2,
      tracks_skipped: 0,
      total_params_attempted: 10,
      total_params_correct: 8,
      total_params_incorrect: 2,
      accuracy_pct: 80,
      first_guess_bonuses_earned: 1,
      max_streak: 2,
      clips_extended: 1,
      total_clip_penalty: -100,
    },
    comparison: null,
    share: null,
    ...overrides,
  };
}

describe('playerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.persist.clearStorage();
    usePlayerStore.setState(usePlayerStore.getInitialState());
  });

  it('updateAfterGame accumulates lifetime stats', () => {
    usePlayerStore.getState().updateAfterGame(makeSession());
    const state = usePlayerStore.getState();
    expect(state.games_played).toBe(1);
    expect(state.total_score_all_time).toBe(1000);
    expect(state.best_score_ever).toBe(1000);
    expect(state.avg_score_per_game).toBe(1000);
    expect(state.perfect_tracks).toBe(2);
  });

  it('best_score_ever only increases', () => {
    usePlayerStore.getState().updateAfterGame(makeSession({ totals: { ...makeSession().totals, total_score: 1000 } }));
    usePlayerStore.getState().updateAfterGame(makeSession({ totals: { ...makeSession().totals, total_score: 500 } }));
    expect(usePlayerStore.getState().best_score_ever).toBe(1000);
  });

  it('daily drop streak increments on consecutive days, resets on a gap', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    usePlayerStore.setState({ daily_drop_streak: 3, daily_drop_streak_date: yesterday.toISOString().slice(0, 10) });

    usePlayerStore.getState().updateAfterGame(makeSession({ mode: 'daily' }));
    expect(usePlayerStore.getState().daily_drop_streak).toBe(4);

    // Playing again today should not double-count.
    usePlayerStore.getState().updateAfterGame(makeSession({ mode: 'daily' }));
    expect(usePlayerStore.getState().daily_drop_streak).toBe(4);
  });

  it('daily drop streak resets to 1 after a missed day', () => {
    usePlayerStore.setState({ daily_drop_streak: 5, daily_drop_streak_date: '2020-01-01' });
    usePlayerStore.getState().updateAfterGame(makeSession({ mode: 'daily' }));
    expect(usePlayerStore.getState().daily_drop_streak).toBe(1);
  });

  it('setDisplayName updates the display name', () => {
    usePlayerStore.getState().setDisplayName('Glen A');
    expect(usePlayerStore.getState().display_name).toBe('Glen A');
  });

  it('unlockBadge is idempotent', () => {
    usePlayerStore.getState().unlockBadge('first_blood');
    usePlayerStore.getState().unlockBadge('first_blood');
    expect(usePlayerStore.getState().badges).toEqual(['first_blood']);
  });

  it('defaults to "regular" assist mode and setAssistMode toggles to "expert"', () => {
    expect(usePlayerStore.getState().assist_mode).toBe('regular');
    usePlayerStore.getState().setAssistMode('expert');
    expect(usePlayerStore.getState().assist_mode).toBe('expert');
  });
});
