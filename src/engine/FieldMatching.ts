import { fuzzyMatch, fuzzyMatchYear, fuzzyMatchPartial } from './FuzzyMatcher';
import type {
  FieldId,
  FieldInputType,
  TrackAnswers,
  TextAnswer,
  NumericAnswer,
  ChoiceAnswer,
  MultiValueAnswer,
  FuzzyTextAnswer,
  SimpleAnswer,
} from '../types/track';
import type { FieldGuessValue } from '../types/session';

/** Outcome of matching a submitted value against a track's canonical answer (DeepDive §A.7). */
export interface FieldMatchResult {
  correct: boolean;
  /** Fraction (0-1) of a multi-value field's accepted entries that were matched. */
  partial: number;
}

/** Default chip options for "choice" type fields not yet configurable per-challenge (Phase 3 will expand these). */
export const DEFAULT_CHOICE_OPTIONS: Partial<Record<FieldId, string[]>> = {
  genre: ['Rock', 'Pop', 'Hip-Hop', 'Electronic', 'Country', 'R&B'],
  certified_copies: ['Gold', 'Platinum', '2x Platinum', '3x Platinum', 'Diamond', 'None'],
  instrument_solo: ['Guitar', 'Drums', 'Bass', 'Piano', 'Saxophone', 'Vocals'],
  key_signature: [
    'C major', 'C minor', 'D♭ major', 'D♭ minor',
    'D major', 'D minor', 'E♭ major', 'E♭ minor',
    'E major', 'E minor', 'F major', 'F minor',
    'F♯ major', 'F♯ minor', 'G major', 'G minor',
    'A♭ major', 'A♭ minor', 'A major', 'A minor',
    'B♭ major', 'B♭ minor', 'B major', 'B minor',
  ],
};

const emptyMatch = (partial = 0): FieldMatchResult => ({ correct: false, partial });

/**
 * Matches a submitted guess against a track's canonical answer for `fieldId`,
 * dispatching to the appropriate `FuzzyMatcher` strategy by input type.
 */
export function evaluateFieldGuess(
  type: FieldInputType,
  value: FieldGuessValue,
  answer: TrackAnswers[FieldId],
): FieldMatchResult {
  switch (type) {
    case 'text': {
      if (typeof value !== 'string') return emptyMatch();
      const a = answer as TextAnswer | FuzzyTextAnswer | SimpleAnswer;
      if (a.value === null) return emptyMatch();
      if ('aliases' in a) {
        return { correct: fuzzyMatch(value, a.value, a.aliases), partial: 0 };
      }
      if ('fuzzy_tolerance' in a) {
        return { correct: fuzzyMatch(value, a.value, [], a.fuzzy_tolerance), partial: 0 };
      }
      return { correct: fuzzyMatch(value, a.value), partial: 0 };
    }
    case 'year': {
      if (typeof value !== 'string' && typeof value !== 'number') return emptyMatch();
      const a = answer as NumericAnswer;
      if (a.value === null) return emptyMatch();
      return { correct: fuzzyMatchYear(value, a.value, a.tolerance), partial: 0 };
    }
    case 'choice': {
      const a = answer as ChoiceAnswer;
      const accepted = Array.isArray(a.value) ? a.value : a.value !== null ? [a.value] : [];
      if (accepted.length === 0) return emptyMatch();
      const submitted = Array.isArray(value) ? value : [String(value)];
      const correct =
        submitted.length === accepted.length && submitted.every((v) => accepted.includes(v));
      return { correct, partial: correct ? 1 : 0 };
    }
    case 'multi': {
      const a = answer as MultiValueAnswer;
      if (a.value.length === 0) return emptyMatch();
      const submitted = Array.isArray(value) ? value : [String(value)];
      const result = fuzzyMatchPartial(submitted, a.value);
      const correct = result.ratio === 1;
      return { correct, partial: a.partial_credit ? result.ratio : correct ? 1 : 0 };
    }
  }
}
