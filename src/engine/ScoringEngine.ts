import type { Challenge, PlayerResult } from '../types/challenge';
import type { FieldDefinition, FieldId, Track } from '../types/track';

/** Static scoring properties for every guessable field (Blueprint §3, DeepDive §A.3). */
export const FIELD_DEFINITIONS: Record<FieldId, FieldDefinition> = {
  song_title: { fieldId: 'song_title', tier: 1, basePoints: 500, difficultyWeight: 1.0, inputType: 'text', label: 'Song Title' },
  primary_artist: { fieldId: 'primary_artist', tier: 1, basePoints: 500, difficultyWeight: 1.2, inputType: 'text', label: 'Primary Artist' },
  release_year: { fieldId: 'release_year', tier: 1, basePoints: 400, difficultyWeight: 1.0, inputType: 'year', label: 'Release Year' },
  album_name: { fieldId: 'album_name', tier: 1, basePoints: 600, difficultyWeight: 1.4, inputType: 'text', label: 'Album Name' },
  songwriter: { fieldId: 'songwriter', tier: 2, basePoints: 800, difficultyWeight: 1.6, inputType: 'multi', label: 'Songwriter(s)' },
  producer: { fieldId: 'producer', tier: 2, basePoints: 900, difficultyWeight: 1.8, inputType: 'text', label: 'Producer' },
  record_label: { fieldId: 'record_label', tier: 2, basePoints: 650, difficultyWeight: 1.5, inputType: 'text', label: 'Record Label' },
  genre: { fieldId: 'genre', tier: 2, basePoints: 350, difficultyWeight: 1.1, inputType: 'choice', label: 'Genre' },
  band_members: { fieldId: 'band_members', tier: 3, basePoints: 1000, difficultyWeight: 2.0, inputType: 'multi', label: 'Band Members' },
  featured_artist: { fieldId: 'featured_artist', tier: 3, basePoints: 500, difficultyWeight: 1.4, inputType: 'text', label: 'Featured Artist' },
  bpm: { fieldId: 'bpm', tier: 3, basePoints: 700, difficultyWeight: 1.7, inputType: 'year', label: 'BPM' },
  key_signature: { fieldId: 'key_signature', tier: 3, basePoints: 700, difficultyWeight: 1.6, inputType: 'choice', label: 'Musical Key' },
  chart_peak: { fieldId: 'chart_peak', tier: 3, basePoints: 800, difficultyWeight: 1.8, inputType: 'year', label: 'Chart Peak Position' },
  sample_source: { fieldId: 'sample_source', tier: 3, basePoints: 1200, difficultyWeight: 2.5, inputType: 'text', label: 'Sample Source' },
  certified_copies: { fieldId: 'certified_copies', tier: 3, basePoints: 600, difficultyWeight: 1.5, inputType: 'choice', label: 'RIAA Certification' },
  music_video_director: { fieldId: 'music_video_director', tier: 3, basePoints: 1000, difficultyWeight: 2.2, inputType: 'text', label: 'Music Video Director' },
  opening_lyric: { fieldId: 'opening_lyric', tier: 3, basePoints: 700, difficultyWeight: 1.5, inputType: 'text', label: 'Opening Lyric' },
  instrument_solo: { fieldId: 'instrument_solo', tier: 3, basePoints: 650, difficultyWeight: 1.3, inputType: 'choice', label: 'Instrument Solo' },
  covered_by: { fieldId: 'covered_by', tier: 3, basePoints: 750, difficultyWeight: 1.9, inputType: 'multi', label: 'Covered By' },
  soundtrack: { fieldId: 'soundtrack', tier: 3, basePoints: 850, difficultyWeight: 1.8, inputType: 'text', label: 'Soundtrack Appearance' },
};

/** Maximum speed multiplier, awarded for submissions at t <= 5s (DeepDive §A.4). */
export const MAX_SPEED_MULTIPLIER = 2.0;

/** Floor speed multiplier, applied for submissions at t > 60s (DeepDive §A.4). */
export const MIN_SPEED_MULTIPLIER = 0.5;

/** Flat first-guess bonus, awarded once per track (DeepDive §A.6). */
export const FIRST_GUESS_BONUS = 500;

/**
 * Cumulative clip extension penalty by extension count, indexed 0 = first
 * extension (1s->3s). Values are cumulative totals (DeepDive §A.5).
 */
export const CUMULATIVE_CLIP_PENALTIES = [100, 250, 450, 750] as const;

/**
 * Continuous piecewise speed-decay curve (DeepDive §A.4).
 *
 * t <= 5s   -> 2.0
 * t <= 15s  -> 2.0 down to 1.3 (linear)
 * t <= 30s  -> 1.3 down to 1.0 (linear)
 * t <= 60s  -> 1.0 down to 0.8 (linear)
 * t > 60s   -> 0.5 (floor)
 */
export function computeSpeedMultiplier(elapsedSeconds: number): number {
  const t = elapsedSeconds;
  if (t <= 5) return MAX_SPEED_MULTIPLIER;
  if (t <= 15) return 2.0 - ((t - 5) / 10) * 0.7;
  if (t <= 30) return 1.3 - ((t - 15) / 15) * 0.3;
  if (t <= 60) return 1.0 - ((t - 30) / 30) * 0.2;
  return MIN_SPEED_MULTIPLIER;
}

/**
 * Score contribution of a single field (DeepDive §A.2, §A.7).
 *
 * `clipsExtended` does not affect the per-field formula directly — the clip
 * extension penalty is deducted once per track via
 * {@link computeClipExtensionPenalty}, not per field — but is accepted here
 * to mirror the master formula's signature for future per-field attribution.
 */
export function computeFieldScore(
  fieldId: FieldId,
  correct: boolean,
  elapsedMs: number,
  _clipsExtended: number,
  partialRatio: number,
): number {
  if (!correct || partialRatio <= 0) return 0;
  const def = FIELD_DEFINITIONS[fieldId];
  const speedMultiplier = computeSpeedMultiplier(elapsedMs / 1000);
  return def.basePoints * def.difficultyWeight * speedMultiplier * partialRatio;
}

/**
 * Flat +500 bonus for a confident, fully-correct, single-submission answer
 * within 10 seconds and with zero clip extensions (DeepDive §A.6).
 */
export function computeFirstGuessBonus(
  allCorrect: boolean,
  clipsExtended: number,
  elapsedSeconds: number,
  bonusAmount: number = FIRST_GUESS_BONUS,
): number {
  if (!allCorrect || clipsExtended > 0 || elapsedSeconds > 10) return 0;
  return bonusAmount;
}

/**
 * Multiplier bonus applied to a track's total based on the number of
 * consecutive qualifying tracks immediately preceding it (DeepDive §A.8).
 * Returns a fraction (e.g. 0.35 for +35%), not a multiplier.
 */
export function computeStreakBonus(streakLength: number): number {
  if (streakLength >= 5) return 0.5;
  if (streakLength === 4) return 0.35;
  if (streakLength === 3) return 0.2;
  if (streakLength === 2) return 0.1;
  return 0;
}

/**
 * Total points deducted for clip extensions on a track (DeepDive §A.5).
 *
 * The flat penalty for the highest extension reached is scaled by the
 * fraction of the track's score that came from fields answered after the
 * extension (the "remaining fields" edge case).
 */
export function computeClipExtensionPenalty(
  clipExtensions: number,
  remainingFieldsPct: number,
  penalties: readonly number[] = CUMULATIVE_CLIP_PENALTIES,
): number {
  if (clipExtensions <= 0) return 0;
  const index = Math.min(clipExtensions, penalties.length) - 1;
  return penalties[index] * remainingFieldsPct;
}

/**
 * Master formula for a single track's score (DeepDive §A.2). The outer
 * `max(0, ...)` ensures a track never contributes negative points.
 */
export function computeTrackScore(
  fieldScores: number[],
  firstGuessBonus: number,
  clipExtensionPenalty: number,
): number {
  const sum = fieldScores.reduce((total, score) => total + score, 0) + firstGuessBonus;
  return Math.max(0, sum - clipExtensionPenalty);
}

/** Number of independently-scored entries for a multi-value field on a track. */
function fieldEntryCount(track: Track, fieldId: FieldId): number {
  if (fieldId === 'band_members') return Math.max(track.answers.band_members.value.length, 0);
  if (fieldId === 'covered_by') return Math.max(track.answers.covered_by.value.length, 0);
  return 1;
}

/**
 * Theoretical maximum score for a challenge, assuming max speed multiplier,
 * a first-guess bonus on every track, and a full streak throughout
 * (DeepDive §A.10).
 */
export function computeMaxPossibleScore(challenge: Challenge, tracks: Track[]): number {
  let total = 0;
  challenge.tracks.forEach((trackId, index) => {
    const track = tracks.find((t) => t.track_id === trackId);
    if (!track) return;

    const fields = challenge.active_params[trackId] ?? [];
    let trackTotal = fields.reduce((sum, fieldId) => {
      const def = FIELD_DEFINITIONS[fieldId];
      const count = fieldEntryCount(track, fieldId);
      return sum + def.basePoints * def.difficultyWeight * MAX_SPEED_MULTIPLIER * count;
    }, 0);

    trackTotal += challenge.scoring.first_guess_bonus;

    const streakBonus = computeStreakBonus(index);
    trackTotal *= 1 + streakBonus;

    total += trackTotal;
  });
  return total;
}

/**
 * Server-side sanity check for a submitted result (TechStack §D.13).
 * Allows a 5% tolerance over the theoretical maximum for rounding.
 */
export function validateResultScore(
  result: PlayerResult,
  challenge: Challenge,
  maxPossibleScore: number,
): boolean {
  if (result.score > maxPossibleScore * 1.05) return false;
  const minPossibleTimeSeconds = challenge.tracks.length * 1;
  if (result.durationSeconds < minPossibleTimeSeconds) return false;
  return true;
}
