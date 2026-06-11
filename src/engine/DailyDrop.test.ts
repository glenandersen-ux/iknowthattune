import { describe, it, expect } from 'vitest';
import { difficultyLabel, getDailyTrackId, todayIso } from './DailyDrop';
import type { Track } from '../types/track';

const track = (id: string): Track =>
  ({
    track_id: id,
  }) as unknown as Track;

describe('getDailyTrackId', () => {
  it('returns null for an empty catalog', () => {
    expect(getDailyTrackId([], '2026-06-10')).toBeNull();
  });

  it('is deterministic for the same date', () => {
    const tracks = [track('a'), track('b'), track('c')];
    const first = getDailyTrackId(tracks, '2026-06-10');
    const second = getDailyTrackId(tracks, '2026-06-10');
    expect(first).toBe(second);
    expect(tracks.map((t) => t.track_id)).toContain(first);
  });

  it('can return different tracks for different dates', () => {
    const tracks = [track('a'), track('b'), track('c'), track('d'), track('e')];
    const ids = new Set(
      ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'].map((date) =>
        getDailyTrackId(tracks, date),
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('difficultyLabel', () => {
  it('classifies scores into Easy, Medium, and Hard', () => {
    expect(difficultyLabel(1.0)).toBe('Easy');
    expect(difficultyLabel(2.0)).toBe('Medium');
    expect(difficultyLabel(3.0)).toBe('Hard');
  });
});

describe('todayIso', () => {
  it('returns a YYYY-MM-DD formatted date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
