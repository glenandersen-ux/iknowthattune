import { describe, it, expect, vi } from 'vitest';
import { handleDailyRequest } from './daily';
import type { Env } from '../env';

function makeEnv(store: Record<string, string>): Env {
  return {
    CHALLENGES_KV: {
      get: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
    } as unknown as Env['CHALLENGES_KV'],
    R2: {} as unknown as Env['R2'],
    LEADERBOARD: {} as unknown as Env['LEADERBOARD'],
  };
}

describe('handleDailyRequest', () => {
  it('returns the trackId stored under daily:<date> for an explicit date', async () => {
    const env = makeEnv({ 'daily:2026-06-12': 'tk_queen_bohrhap' });
    const request = new Request('https://iknowthattune.com/api/daily?date=2026-06-12');

    const response = await handleDailyRequest(request, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ date: '2026-06-12', trackId: 'tk_queen_bohrhap' });
  });

  it('defaults to today when no date is given', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const env = makeEnv({ [`daily:${today}`]: 'tk_beatles_heyjude' });
    const request = new Request('https://iknowthattune.com/api/daily');

    const response = await handleDailyRequest(request, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ date: today, trackId: 'tk_beatles_heyjude' });
  });

  it('returns 404 when no daily drop is scheduled for the date', async () => {
    const env = makeEnv({});
    const request = new Request('https://iknowthattune.com/api/daily?date=2026-01-01');

    const response = await handleDailyRequest(request, env);

    expect(response.status).toBe(404);
  });
});
