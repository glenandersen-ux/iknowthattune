import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { useCatalogStore } from './catalogStore';
import type { Challenge } from '../types/challenge';
import type { Track } from '../types/track';

const buildTrack = (id: string, title: string): Track => ({
  track_id: id,
  clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
  clip_start_offset_ms: 0,
  answers: {
    song_title: { value: title, aliases: [] },
    primary_artist: { value: 'Test Artist', aliases: [] },
    release_year: { value: 2000, tolerance: 2 },
    album_name: { value: 'Test Album', aliases: [] },
    songwriter: { value: [], partial_credit: true },
    producer: { value: null, aliases: [] },
    record_label: { value: null, aliases: [] },
    genre: { value: ['Rock'] },
    band_members: { value: [], partial_credit: true },
    featured_artist: { value: null },
    bpm: { value: null, tolerance: 5 },
    key_signature: { value: null },
    chart_peak: { value: null, tolerance: 2 },
    sample_source: { value: null },
    certified_copies: { value: null },
    music_video_director: { value: null },
    opening_lyric: { value: null, fuzzy_tolerance: 2 },
    instrument_solo: { value: null },
    covered_by: { value: [], partial_credit: true },
    soundtrack: { value: null },
  },
  metadata: { decade: 2000, language: 'en', tags: [], difficulty_score: 1 },
});

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
    'track-1': ['song_title', 'primary_artist', 'release_year', 'album_name'],
    'track-2': ['song_title', 'primary_artist', 'release_year', 'album_name'],
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
    streak_multipliers: [0.1, 0.2, 0.35, 0.5],
  },
};

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useCatalogStore.setState({
      tracks: [buildTrack('track-1', 'Track One'), buildTrack('track-2', 'Track Two')],
    });
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

  it('tick updates elapsed time and recomputes the speed multiplier', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().startTrack();
    useGameStore.getState().tick(20000);
    const state = useGameStore.getState();
    expect(state.timeElapsedMs).toBe(20000);
    expect(state.speedMultiplier).toBeCloseTo(1.2, 5);
  });

  it('clipEnded transitions from playing to guessing', () => {
    useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
    useGameStore.getState().startTrack();
    useGameStore.getState().clipEnded();
    expect(useGameStore.getState().phase).toBe('guessing');
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

  describe('submitGuess', () => {
    it('scores a fully correct, fast, zero-extension submission with the first guess bonus', () => {
      useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
      useGameStore.getState().startTrack();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Track One' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);

      const state = useGameStore.getState();
      expect(state.phase).toBe('reveal');
      const trackSession = state.session.tracks[0];
      expect(trackSession.fields_correct).toEqual(['song_title', 'primary_artist', 'release_year', 'album_name']);
      expect(trackSession.fields_incorrect).toEqual([]);
      expect(trackSession.first_guess_bonus_earned).toBe(true);
      // (500*1.0 + 500*1.2 + 400*1.0 + 600*1.4) * 2.0 speed + 500 bonus = 4680 + 500
      expect(trackSession.raw_score).toBeCloseTo(5180, 5);
      expect(trackSession.clip_penalty_applied).toBe(0);
      expect(state.session.totals.total_score).toBeCloseTo(5180, 5);
      expect(state.session.totals.tracks_perfect).toBe(1);
    });

    it('withholds the first guess bonus and marks fields incorrect on a wrong guess', () => {
      useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
      useGameStore.getState().startTrack();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Wrong Title' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);

      const trackSession = useGameStore.getState().session.tracks[0];
      expect(trackSession.fields_correct).toEqual(['primary_artist', 'release_year', 'album_name']);
      expect(trackSession.fields_incorrect).toEqual(['song_title']);
      expect(trackSession.first_guess_bonus_earned).toBe(false);
      // song_title scores 0; remaining fields score (500*1.2 + 400*1.0 + 600*1.4) * 2.0
      expect(trackSession.raw_score).toBeCloseTo(3680, 5);
    });

    it('applies the clip extension penalty and withholds the first guess bonus', () => {
      useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
      useGameStore.getState().startTrack();
      useGameStore.getState().extendClip();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Track One' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);

      const state = useGameStore.getState();
      const trackSession = state.session.tracks[0];
      expect(trackSession.first_guess_bonus_earned).toBe(false);
      expect(trackSession.clip_penalty_applied).toBe(-100);
      expect(state.session.totals.total_clip_penalty).toBe(-100);
      // 4680 raw - 100 penalty
      expect(state.session.totals.total_score).toBeCloseTo(4580, 5);
      expect(state.session.totals.tracks_perfect).toBe(0);
    });

    it('records an increasing streak position across consecutive qualifying tracks', () => {
      useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
      useGameStore.getState().startTrack();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Track One' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);
      useGameStore.getState().advanceTrack();
      useGameStore.getState().startTrack();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Track Two' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);

      const state = useGameStore.getState();
      expect(state.session.tracks[0].streak_position).toBe(0);
      expect(state.session.tracks[1].streak_position).toBe(1);
      expect(state.session.totals.max_streak).toBe(2);
    });

    it('applies the streak bonus from the prior qualifying streak to the current track score', () => {
      const threeTrackChallenge: Challenge = {
        ...mockChallenge,
        tracks: ['track-1', 'track-2', 'track-3'],
        active_params: {
          'track-1': ['song_title', 'primary_artist', 'release_year', 'album_name'],
          'track-2': ['song_title', 'primary_artist', 'release_year', 'album_name'],
          'track-3': ['song_title', 'primary_artist', 'release_year', 'album_name'],
        },
        clip_starts: { 'track-1': 'hook', 'track-2': 'hook', 'track-3': 'hook' },
      };
      useCatalogStore.setState({
        tracks: [buildTrack('track-1', 'Track One'), buildTrack('track-2', 'Track Two'), buildTrack('track-3', 'Track Three')],
      });
      useGameStore.getState().loadChallenge(threeTrackChallenge, 'solo', 'Glen');

      // Track 1 and 2 both qualify, building a streak of 2 entering track 3.
      for (const title of ['Track One', 'Track Two']) {
        useGameStore.getState().startTrack();
        useGameStore.getState().tick(1000);
        useGameStore.getState().submitGuess([
          { fieldId: 'song_title', value: title },
          { fieldId: 'primary_artist', value: 'Test Artist' },
          { fieldId: 'release_year', value: '2000' },
          { fieldId: 'album_name', value: 'Test Album' },
        ]);
        useGameStore.getState().advanceTrack();
      }

      useGameStore.getState().startTrack();
      useGameStore.getState().tick(1000);
      useGameStore.getState().submitGuess([
        { fieldId: 'song_title', value: 'Track Three' },
        { fieldId: 'primary_artist', value: 'Test Artist' },
        { fieldId: 'release_year', value: '2000' },
        { fieldId: 'album_name', value: 'Test Album' },
      ]);

      const trackThree = useGameStore.getState().session.tracks[2];
      expect(trackThree.streak_position).toBe(2);
      // Same base score as track 1 (5180), with the +10% streak bonus for streak length 2.
      expect(trackThree.raw_score).toBeCloseTo(5180 * 1.1, 5);
    });
  });

  describe('skipTrack', () => {
    it('scores zero, marks the track as given up, and reveals the answer', () => {
      useGameStore.getState().loadChallenge(mockChallenge, 'solo', 'Glen');
      useGameStore.getState().startTrack();
      useGameStore.getState().tick(5000);
      useGameStore.getState().skipTrack();

      const state = useGameStore.getState();
      expect(state.phase).toBe('reveal');
      const trackSession = state.session.tracks[0];
      expect(trackSession.gave_up).toBe(true);
      expect(trackSession.raw_score).toBe(0);
      expect(trackSession.fields_skipped).toEqual(['song_title', 'primary_artist', 'release_year', 'album_name']);
      expect(state.session.totals.tracks_skipped).toBe(1);
      expect(state.session.totals.total_score).toBe(0);
    });
  });
});
