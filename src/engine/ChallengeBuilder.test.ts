import { describe, it, expect } from 'vitest';
import { buildSoloChallenge, DEFAULT_ACTIVE_FIELDS, DEFAULT_CHALLENGE_SCORING } from './ChallengeBuilder';
import type { Track } from '../types/track';

const track = (id: string): Track => ({
  track_id: id,
  clip_urls: { '1s': 'a', '3s': 'b', '5s': 'c', '10s': 'd', '30s': 'e' },
  clip_start_offset_ms: 0,
  answers: {
    song_title: { value: 'Title', aliases: [] },
    primary_artist: { value: 'Artist', aliases: [] },
    release_year: { value: 2000, tolerance: 2 },
    album_name: { value: 'Album', aliases: [] },
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

describe('buildSoloChallenge', () => {
  it('builds a challenge with Tier 1 active fields and "hook" clip starts for every track', () => {
    const tracks = [track('t1'), track('t2')];
    const challenge = buildSoloChallenge(tracks, 'solo', 'player-1');

    expect(challenge.tracks).toEqual(['t1', 't2']);
    expect(challenge.active_params.t1).toEqual(DEFAULT_ACTIVE_FIELDS);
    expect(challenge.active_params.t2).toEqual(DEFAULT_ACTIVE_FIELDS);
    expect(challenge.clip_starts.t1).toBe('hook');
    expect(challenge.scoring).toEqual(DEFAULT_CHALLENGE_SCORING);
    expect(challenge.creator_player_id).toBe('player-1');
  });

  it('uses mode-specific id and name', () => {
    const daily = buildSoloChallenge([track('t1')], 'daily', 'player-1');
    expect(daily.id).toBe('daily-drop');
    expect(daily.name).toBe("Today's Drop");

    const solo = buildSoloChallenge([track('t1')], 'solo', 'player-1');
    expect(solo.id).toBe('solo-sprint');
    expect(solo.name).toBe('Solo Sprint');
  });
});
