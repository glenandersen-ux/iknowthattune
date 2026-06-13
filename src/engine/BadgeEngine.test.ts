import { describe, it, expect } from 'vitest';
import { computeBadgeProgress, evaluateBadges } from './BadgeEngine';
import type { PlayerProfile, PlayerSession, TrackSession } from '../types/session';
import type { Track } from '../types/track';

const baseTrackSession: TrackSession = {
  track_id: 'track-1',
  play_order: 1,
  clip_sequence_used: ['1s'],
  time_to_first_submit_ms: 2000,
  total_time_on_track_ms: 2000,
  submit_count: 1,
  fields_attempted: ['song_title', 'primary_artist', 'release_year', 'album_name'],
  fields_correct: ['song_title', 'primary_artist', 'release_year', 'album_name'],
  fields_incorrect: [],
  fields_skipped: [],
  first_guess_bonus_earned: true,
  streak_position: 0,
  raw_score: 5180,
  clip_penalty_applied: 0,
  speed_multiplier_applied: 2.0,
  guess_history: [
    {
      submit_index: 1,
      clip_at_submission: '1s',
      time_ms: 2000,
      guesses: { release_year: '2000' },
      results: { release_year: 'correct' },
    },
  ],
};

function makeSession(overrides: Partial<PlayerSession> = {}): PlayerSession {
  return {
    session_id: 'session-1',
    player_name: 'Glen',
    challenge_id: null,
    mode: 'solo',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 30,
    device_type: 'desktop',
    tracks: [baseTrackSession],
    totals: {
      total_score: 5180,
      tracks_completed: 1,
      tracks_perfect: 1,
      tracks_skipped: 0,
      total_params_attempted: 4,
      total_params_correct: 4,
      total_params_incorrect: 0,
      accuracy_pct: 100,
      first_guess_bonuses_earned: 1,
      max_streak: 1,
      clips_extended: 0,
      total_clip_penalty: 0,
    },
    comparison: null,
    share: null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    player_id: 'player-1',
    display_name: 'Glen',
    created_at: new Date().toISOString(),
    games_played: 0,
    games_created: 0,
    challenges_shared: 0,
    challenges_received: 0,
    total_score_all_time: 0,
    avg_score_per_game: 0,
    best_score_ever: 0,
    perfect_tracks: 0,
    accuracy_all_time_pct: 0,
    favorite_genres: [],
    hardest_field_accuracy: {},
    easiest_field_accuracy: {},
    badges: [],
    challenges_beaten: [],
    daily_drop_streak: 0,
    daily_drop_streak_date: null,
    bands_correctly_named: [],
    sample_sources_correct: 0,
    years_within_one: 0,
    field_stats: {},
    assist_mode: 'regular',
    ...overrides,
  };
}

const track: Track = {
  track_id: 'track-1',
  clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
  clip_start_offset_ms: 0,
  answers: {
    song_title: { value: 'Track One', aliases: [] },
    primary_artist: { value: 'Test Artist', aliases: [] },
    release_year: { value: 2000, tolerance: 2 },
    album_name: { value: 'Test Album', aliases: [] },
    songwriter: { value: [], partial_credit: true },
    producer: { value: null, aliases: [] },
    record_label: { value: null, aliases: [] },
    genre: { value: ['Rock'] },
    band_members: { value: ['Alice', 'Bob'], partial_credit: true },
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
};

describe('evaluateBadges', () => {
  it('unlocks first_blood the first time a session has any correct field', () => {
    const session = makeSession();
    const profile = makeProfile();
    expect(evaluateBadges(session, profile)).toContain('first_blood');
  });

  it('does not re-unlock first_blood once already earned', () => {
    const session = makeSession();
    const profile = makeProfile({ badges: ['first_blood'] });
    expect(evaluateBadges(session, profile)).not.toContain('first_blood');
  });

  it('unlocks lightning_round when every track was guessed correctly within 5 seconds', () => {
    const session = makeSession({ tracks: [{ ...baseTrackSession, time_to_first_submit_ms: 4000 }] });
    expect(evaluateBadges(session, makeProfile())).toContain('lightning_round');
  });

  it('does not unlock lightning_round if any track took 5 seconds or more', () => {
    const session = makeSession({ tracks: [{ ...baseTrackSession, time_to_first_submit_ms: 6000 }] });
    expect(evaluateBadges(session, makeProfile())).not.toContain('lightning_round');
  });

  it('unlocks encyclopedia when every attempted Tier 3 field is correct', () => {
    const session = makeSession({
      tracks: [
        {
          ...baseTrackSession,
          fields_attempted: ['song_title', 'sample_source'],
          fields_correct: ['song_title', 'sample_source'],
          fields_incorrect: [],
        },
      ],
    });
    expect(evaluateBadges(session, makeProfile())).toContain('encyclopedia');
  });

  it('does not unlock encyclopedia if a Tier 3 field was missed', () => {
    const session = makeSession({
      tracks: [
        {
          ...baseTrackSession,
          fields_attempted: ['song_title', 'sample_source'],
          fields_correct: ['song_title'],
          fields_incorrect: ['sample_source'],
        },
      ],
    });
    expect(evaluateBadges(session, makeProfile())).not.toContain('encyclopedia');
  });

  it('unlocks on_fire after a 5-track streak with first-guess bonuses', () => {
    const session = makeSession({ tracks: Array.from({ length: 5 }, () => ({ ...baseTrackSession })) });
    expect(evaluateBadges(session, makeProfile())).toContain('on_fire');
  });

  it('unlocks band_nerd, sample_detective, and year_wizard once lifetime thresholds are reached', () => {
    const profile = makeProfile({
      bands_correctly_named: Array.from({ length: 10 }, (_, i) => `track-${i}`),
      sample_sources_correct: 5,
      years_within_one: 25,
    });
    const badges = evaluateBadges(makeSession(), profile);
    expect(badges).toContain('band_nerd');
    expect(badges).toContain('sample_detective');
    expect(badges).toContain('year_wizard');
  });
});

describe('computeBadgeProgress', () => {
  it('records a correctly-named band, a correct sample source, and a year within ±1', () => {
    const session = makeSession({
      tracks: [
        {
          ...baseTrackSession,
          fields_attempted: ['release_year', 'band_members', 'sample_source'],
          fields_correct: ['release_year', 'band_members', 'sample_source'],
          guess_history: [
            {
              submit_index: 1,
              clip_at_submission: '1s',
              time_ms: 2000,
              guesses: { release_year: '2001' },
              results: { release_year: 'correct' },
            },
          ],
        },
      ],
    });
    const progress = computeBadgeProgress(session, [track]);
    expect(progress.bands_correctly_named).toEqual(['track-1']);
    expect(progress.sample_sources_correct).toBe(1);
    expect(progress.years_within_one).toBe(1);
  });

  it('does not count a year guess outside ±1', () => {
    const session = makeSession({
      tracks: [
        {
          ...baseTrackSession,
          guess_history: [
            {
              submit_index: 1,
              clip_at_submission: '1s',
              time_ms: 2000,
              guesses: { release_year: '1998' },
              results: { release_year: 'correct' },
            },
          ],
        },
      ],
    });
    expect(computeBadgeProgress(session, [track]).years_within_one).toBe(0);
  });
});
