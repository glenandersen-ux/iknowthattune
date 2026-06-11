import { FIELD_DEFINITIONS } from './ScoringEngine';
import type { BadgeId, PlayerProfile, PlayerSession, TrackSession } from '../types/session';
import type { Track } from '../types/track';

/** Display metadata for a badge (Blueprint §13). */
export interface BadgeDefinition {
  id: BadgeId;
  icon: string;
  name: string;
  description: string;
}

/** All badges, in unlock-priority order (Blueprint §13). */
export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_blood: {
    id: 'first_blood',
    icon: '🎯',
    name: 'First Blood',
    description: 'Get your first correct guess.',
  },
  lightning_round: {
    id: 'lightning_round',
    icon: '⚡',
    name: 'Lightning Round',
    description: 'Guess every track in a game in under 5 seconds.',
  },
  encyclopedia: {
    id: 'encyclopedia',
    icon: '🧠',
    name: 'Encyclopedia',
    description: '100% accuracy on every Tier 3 niche parameter in a game.',
  },
  on_fire: {
    id: 'on_fire',
    icon: '🔥',
    name: 'On Fire',
    description: 'A 5-track streak with a first-guess bonus on every track.',
  },
  stump_master: {
    id: 'stump_master',
    icon: '👑',
    name: 'Stump Master',
    description: 'Created a challenge that no friend has beaten.',
  },
  band_nerd: {
    id: 'band_nerd',
    icon: '🎸',
    name: 'Band Nerd',
    description: 'Correctly named every member of 10 different bands.',
  },
  sample_detective: {
    id: 'sample_detective',
    icon: '🕵️',
    name: 'Sample Detective',
    description: 'Correctly identified 5 sample sources.',
  },
  year_wizard: {
    id: 'year_wizard',
    icon: '📅',
    name: 'Year Wizard',
    description: 'Guessed the release year within ±1 on 25 tracks.',
  },
};

const TIER_3_FIELDS = (Object.keys(FIELD_DEFINITIONS) as (keyof typeof FIELD_DEFINITIONS)[]).filter(
  (fieldId) => FIELD_DEFINITIONS[fieldId].tier === 3,
);

/** A track session "qualifies" for streak/On Fire purposes (DeepDive §A.8). */
function trackQualifies(track: TrackSession): boolean {
  return !track.gave_up && track.fields_incorrect.length === 0;
}

/** True if every track in the session was guessed correctly within 5 seconds of the clip starting. */
function isLightningRound(session: PlayerSession): boolean {
  return (
    session.tracks.length > 0 &&
    session.tracks.every(
      (track) => !track.gave_up && track.fields_incorrect.length === 0 && track.time_to_first_submit_ms <= 5000,
    )
  );
}

/** True if any track attempted at least one Tier 3 field, and every Tier 3 field attempted was correct. */
function isEncyclopedia(session: PlayerSession): boolean {
  let attemptedTier3 = false;
  for (const track of session.tracks) {
    for (const fieldId of track.fields_attempted) {
      if (!TIER_3_FIELDS.includes(fieldId)) continue;
      attemptedTier3 = true;
      if (track.fields_incorrect.includes(fieldId)) return false;
    }
  }
  return attemptedTier3;
}

/** True if 5 consecutive tracks each qualified for the streak AND earned a first-guess bonus. */
function hasOnFireRun(session: PlayerSession): boolean {
  let run = 0;
  for (const track of session.tracks) {
    if (trackQualifies(track) && track.first_guess_bonus_earned) {
      run += 1;
      if (run >= 5) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/** Track IDs in this session where every `band_members` entry was guessed correctly. */
function newlyNamedBands(session: PlayerSession, tracks: Track[]): string[] {
  const ids: string[] = [];
  for (const track of session.tracks) {
    if (!track.fields_correct.includes('band_members')) continue;
    const canonical = tracks.find((t) => t.track_id === track.track_id);
    if (canonical && canonical.answers.band_members.value.length > 0) {
      ids.push(track.track_id);
    }
  }
  return ids;
}

/** Number of `sample_source` fields correctly guessed in this session. */
function newSampleSourcesCorrect(session: PlayerSession): number {
  return session.tracks.filter((track) => track.fields_correct.includes('sample_source')).length;
}

/** Number of `release_year` guesses correct and within ±1 of the canonical year in this session. */
function newYearsWithinOne(session: PlayerSession, tracks: Track[]): number {
  let count = 0;
  for (const track of session.tracks) {
    if (!track.fields_correct.includes('release_year')) continue;
    const canonical = tracks.find((t) => t.track_id === track.track_id);
    if (!canonical || canonical.answers.release_year.value === null) continue;
    const guess = track.guess_history.find((entry) => entry.results.release_year === 'correct')?.guesses
      .release_year;
    if (guess === undefined) continue;
    const guessedYear = typeof guess === 'string' ? Number(guess) : guess;
    if (typeof guessedYear === 'number' && Math.abs(guessedYear - canonical.answers.release_year.value) <= 1) {
      count += 1;
    }
  }
  return count;
}

/**
 * Cumulative lifetime counters this session contributes toward multi-game
 * badges. `playerStore.updateAfterGame` merges these into the persisted
 * profile before calling {@link evaluateBadges}.
 */
export interface BadgeProgressDelta {
  bands_correctly_named: string[];
  sample_sources_correct: number;
  years_within_one: number;
}

/** Computes this session's contribution toward multi-game badge counters. */
export function computeBadgeProgress(session: PlayerSession, tracks: Track[]): BadgeProgressDelta {
  return {
    bands_correctly_named: newlyNamedBands(session, tracks),
    sample_sources_correct: newSampleSourcesCorrect(session),
    years_within_one: newYearsWithinOne(session, tracks),
  };
}

/**
 * Evaluates which badges should newly unlock for `session`, given a
 * `profile` whose lifetime counters already include this session's
 * contribution (see {@link computeBadgeProgress}). Idempotent: a badge
 * already present in `profile.badges` is never returned again.
 */
export function evaluateBadges(session: PlayerSession, profile: PlayerProfile): BadgeId[] {
  const unlocked: BadgeId[] = [];
  const has = (id: BadgeId): boolean => profile.badges.includes(id);

  if (!has('first_blood') && session.totals.total_params_correct > 0) {
    unlocked.push('first_blood');
  }
  if (!has('lightning_round') && isLightningRound(session)) {
    unlocked.push('lightning_round');
  }
  if (!has('encyclopedia') && isEncyclopedia(session)) {
    unlocked.push('encyclopedia');
  }
  if (!has('on_fire') && hasOnFireRun(session)) {
    unlocked.push('on_fire');
  }
  if (!has('band_nerd') && profile.bands_correctly_named.length >= 10) {
    unlocked.push('band_nerd');
  }
  if (!has('sample_detective') && profile.sample_sources_correct >= 5) {
    unlocked.push('sample_detective');
  }
  if (!has('year_wizard') && profile.years_within_one >= 25) {
    unlocked.push('year_wizard');
  }
  // 'stump_master' requires server-side leaderboard data (no friend has beaten the
  // player's created challenge) that is not available to this client-only evaluation.

  return unlocked;
}
