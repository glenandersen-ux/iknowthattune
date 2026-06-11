import { describe, it, expect } from 'vitest';
import { levenshteinDistance, fuzzyMatch, fuzzyMatchYear, fuzzyMatchPartial } from './FuzzyMatcher';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('queen', 'queen')).toBe(0);
  });

  it('counts single-character substitutions', () => {
    expect(levenshteinDistance('queen', 'qieen')).toBe(1);
  });

  it('counts insertions and deletions', () => {
    expect(levenshteinDistance('queen', 'quen')).toBe(1);
    expect(levenshteinDistance('quen', 'queen')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });
});

describe('fuzzyMatch', () => {
  it('matches an exact string', () => {
    expect(fuzzyMatch('Bohemian Rhapsody', 'Bohemian Rhapsody')).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(fuzzyMatch('  bohemian rhapsody ', 'Bohemian Rhapsody')).toBe(true);
  });

  it('accepts typos within the default tolerance of 2', () => {
    expect(fuzzyMatch('Bohemain Rhapsody', 'Bohemian Rhapsody')).toBe(true);
    expect(fuzzyMatch('Bohemian Rapsody', 'Bohemian Rhapsody')).toBe(true);
  });

  it('rejects typos beyond the tolerance', () => {
    expect(fuzzyMatch('Bohemain Rapsdy', 'Bohemian Rhapsody')).toBe(false);
  });

  it('matches against any provided alias', () => {
    expect(fuzzyMatch('Wonder', 'Stevie Wonder', ['Wonder', 'Little Stevie'])).toBe(true);
  });

  it('rejects empty input', () => {
    expect(fuzzyMatch('', 'Stevie Wonder')).toBe(false);
  });

  it('respects a custom tolerance', () => {
    expect(fuzzyMatch('Supersticion', 'Superstition', [], 1)).toBe(true);
    expect(fuzzyMatch('Supersticien', 'Superstition', [], 1)).toBe(false);
  });
});

describe('fuzzyMatchYear', () => {
  it('matches the exact year', () => {
    expect(fuzzyMatchYear(1972, 1972)).toBe(true);
  });

  it('matches within the default ±2 tolerance band', () => {
    expect(fuzzyMatchYear(1970, 1972)).toBe(true);
    expect(fuzzyMatchYear(1974, 1972)).toBe(true);
  });

  it('rejects years outside the tolerance band', () => {
    expect(fuzzyMatchYear(1969, 1972)).toBe(false);
    expect(fuzzyMatchYear(1975, 1972)).toBe(false);
  });

  it('accepts numeric strings', () => {
    expect(fuzzyMatchYear('1973', 1972)).toBe(true);
  });

  it('rejects non-numeric input', () => {
    expect(fuzzyMatchYear('early 70s', 1972)).toBe(false);
  });

  it('respects a custom tolerance band', () => {
    expect(fuzzyMatchYear(1972, 1972, 0)).toBe(true);
    expect(fuzzyMatchYear(1973, 1972, 0)).toBe(false);
  });
});

describe('fuzzyMatchPartial', () => {
  const beatles = ['John Lennon', 'Paul McCartney', 'George Harrison', 'Ringo Starr'];

  it('returns a 3/4 ratio when 3 of 4 accepted values are matched', () => {
    const result = fuzzyMatchPartial(
      ['John Lennon', 'Paul McCartney', 'Ringo Starr', 'Pete Best'],
      beatles,
    );
    expect(result.correct).toHaveLength(3);
    expect(result.incorrect).toEqual(['Pete Best']);
    expect(result.ratio).toBeCloseTo(0.75, 5);
  });

  it('counts duplicate submissions of the same value only once', () => {
    const result = fuzzyMatchPartial(['John Lennon', 'John Lennon', 'Paul McCartney'], beatles);
    expect(result.correct).toHaveLength(2);
    expect(result.ratio).toBeCloseTo(0.5, 5);
  });

  it('matches typos within tolerance for each entry', () => {
    const result = fuzzyMatchPartial(['Jon Lennon', 'Paull McCartney'], beatles);
    expect(result.correct).toHaveLength(2);
  });

  it('returns ratio 0 for an empty accepted set', () => {
    expect(fuzzyMatchPartial(['anything'], []).ratio).toBe(0);
  });

  it('order of submission does not affect the result', () => {
    const a = fuzzyMatchPartial(['Ringo Starr', 'John Lennon'], beatles);
    const b = fuzzyMatchPartial(['John Lennon', 'Ringo Starr'], beatles);
    expect(a.ratio).toBe(b.ratio);
    expect(a.correct.sort()).toEqual(b.correct.sort());
  });
});
