import { describe, it, expect } from 'vitest';
import { evaluateFieldGuess } from './fieldMatching';
import type { TrackAnswers } from '../../types/track';

describe('evaluateFieldGuess', () => {
  it('matches a text field with aliases via fuzzy matching', () => {
    const answer: TrackAnswers['primary_artist'] = { value: 'Queen', aliases: [] };
    expect(evaluateFieldGuess('text', 'queen', answer)).toEqual({ correct: true, partial: 0 });
    expect(evaluateFieldGuess('text', 'Pink Floyd', answer)).toEqual({ correct: false, partial: 0 });
  });

  it('matches a year field within tolerance', () => {
    const answer: TrackAnswers['release_year'] = { value: 1975, tolerance: 2 };
    expect(evaluateFieldGuess('year', '1976', answer)).toEqual({ correct: true, partial: 0 });
    expect(evaluateFieldGuess('year', '1980', answer)).toEqual({ correct: false, partial: 0 });
  });

  it('matches a choice field requiring an exact set', () => {
    const answer: TrackAnswers['genre'] = { value: ['Rock'] };
    expect(evaluateFieldGuess('choice', ['Rock'], answer)).toEqual({ correct: true, partial: 1 });
    expect(evaluateFieldGuess('choice', ['Pop'], answer)).toEqual({ correct: false, partial: 0 });
  });

  it('awards partial credit for a multi-value field', () => {
    const answer: TrackAnswers['band_members'] = {
      value: ['Freddie Mercury', 'Brian May', 'Roger Taylor', 'John Deacon'],
      partial_credit: true,
    };
    const result = evaluateFieldGuess('multi', ['Freddie Mercury', 'Brian May', 'Roger Taylor'], answer);
    expect(result.correct).toBe(false);
    expect(result.partial).toBeCloseTo(0.75, 5);
  });

  it('returns no match for a null canonical value', () => {
    const answer: TrackAnswers['featured_artist'] = { value: null };
    expect(evaluateFieldGuess('text', 'Anyone', answer)).toEqual({ correct: false, partial: 0 });
  });
});
