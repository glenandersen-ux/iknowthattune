import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { Challenge } from '../types/challenge';

const mockChallenge: Challenge = {
  id: 'abc123',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: null,
  name: 'Test Challenge',
  tracks: ['track-1', 'track-2'],
  active_params: {
    'track-1': ['song_title', 'primary_artist'],
    'track-2': ['song_title', 'primary_artist'],
  },
  clip_starts: {
    'track-1': 'hook',
    'track-2': 'hook',
  },
  settings: {
    time_pressure: 'standard',
    hints: 'none',
    expiry_ms: null,
    leaderboard_public: true,
  },
  scoring: {
    first_guess_bonus: 500,
    clip_penalties: [100, 250, 450, 750],
    streak_multipliers: [0, 0.1, 0.2, 0.35],
  },
};

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('loadChallenge resets state and stores the challenge', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    const state = useGameStore.getState();
    expect(state.challenge).toEqual(mockChallenge);
    expect(state.currentTrackIndex).toBe(0);
    expect(state.phase).toBe('idle');
    expect(state.session.challenge_id).toBe('abc123');
    expect(state.session.player_name).toBe('Glen');
  });

  it('startTrack moves phase to playing and resets per-track state', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().startTrack();
    const state = useGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.activeClipDuration).toBe('1s');
    expect(state.speedMultiplier).toBe(2.0);
  });

  it('extendClip advances the clip duration and increments extension count', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().startTrack();
    useGameStore.getState().extendClip();
    const state = useGameStore.getState();
    expect(state.activeClipDuration).toBe('3s');
    expect(state.clipExtensions).toBe(1);
  });

  it('extendClip does nothing once at the max duration', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().startTrack();
    for (let i = 0; i < 10; i += 1) {
      useGameStore.getState().extendClip();
    }
    expect(useGameStore.getState().activeClipDuration).toBe('30s');
  });

  it('advanceTrack moves to the next track index', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().advanceTrack();
    expect(useGameStore.getState().currentTrackIndex).toBe(1);
    expect(useGameStore.getState().phase).toBe('idle');
  });

  it('advanceTrack completes the game after the last track', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().advanceTrack();
    useGameStore.getState().advanceTrack();
    const state = useGameStore.getState();
    expect(state.phase).toBe('complete');
    expect(state.session.completed_at).not.toBeNull();
  });
});
