import type { FieldId } from '../types/track';
import type { PlayerSession } from '../types/session';

/** Lifetime per-field attempt/correct tally, keyed by `FieldId`. */
export type FieldStats = Partial<Record<FieldId, { attempted: number; correct: number }>>;

/** A field needs at least this many lifetime attempts before it's eligible for the hardest/easiest lists. */
const MIN_ATTEMPTS_FOR_RANKING = 3;

/** Number of fields shown in each of the hardest/easiest lists (Phase 3 §3.4). */
const MAX_RANKED_FIELDS = 3;

/** Folds one session's per-field results into the lifetime `field_stats` tally. */
export function updateFieldStats(stats: FieldStats, session: PlayerSession): FieldStats {
  const next: FieldStats = { ...stats };
  for (const track of session.tracks) {
    for (const fieldId of track.fields_attempted) {
      const prev = next[fieldId] ?? { attempted: 0, correct: 0 };
      next[fieldId] = {
        attempted: prev.attempted + 1,
        correct: prev.correct + (track.fields_correct.includes(fieldId) ? 1 : 0),
      };
    }
  }
  return next;
}

/**
 * Derives `hardest_field_accuracy` / `easiest_field_accuracy` from lifetime
 * `field_stats`, considering only fields with at least
 * {@link MIN_ATTEMPTS_FOR_RANKING} attempts.
 */
export function computeFieldAccuracy(stats: FieldStats): {
  hardest: Partial<Record<FieldId, number>>;
  easiest: Partial<Record<FieldId, number>>;
} {
  const ranked = (Object.entries(stats) as [FieldId, { attempted: number; correct: number }][])
    .filter(([, s]) => s.attempted >= MIN_ATTEMPTS_FOR_RANKING)
    .map(([fieldId, s]) => [fieldId, s.correct / s.attempted] as const);

  const hardest = [...ranked].sort((a, b) => a[1] - b[1]).slice(0, MAX_RANKED_FIELDS);
  const easiest = [...ranked].sort((a, b) => b[1] - a[1]).slice(0, MAX_RANKED_FIELDS);

  return {
    hardest: Object.fromEntries(hardest) as Partial<Record<FieldId, number>>,
    easiest: Object.fromEntries(easiest) as Partial<Record<FieldId, number>>,
  };
}
