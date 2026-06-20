import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleChallengeRequest } from './challenge';
import { validateResultScore } from '../../src/engine/ScoringEngine';
import type { Env } from '../env';
import type { Challenge, CreateChallengeRequest, PlayerResult } from '../../src/types/challenge';

vi.mock('../og-generator', () => ({
  generateOgCard: vi.fn(() => Promise.resolve(new Uint8Array())),
}));

vi.mock('../../src/engine/ScoringEngine', () => ({
  computeMaxPossibleScore: vi.fn(() => 1000),
  validateResultScore: vi.fn(() => true),
}));

const baseRequestBody: CreateChallengeRequest = {
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: 1234,
  name: 'My Challenge',
  tracks: ['tk_queen_bohrhap'],
  active_params: { tk_queen_bohrhap: ['song_title', 'primary_artist'] },
  clip_starts: { tk_queen_bohrhap: 'hook' },
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 150, 200, 300], streak_multipliers: [1.1, 1.2, 1.35] },
};

function makeEnv(): { env: Env; kv: Map<string, string>; leaderboardFetch: ReturnType<typeof vi.fn> } {
  const kv = new Map<string, string>();
  const leaderboardFetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ rank: 1 }))));

  const env: Env = {
    CHALLENGES_KV: {
      get: vi.fn((key: string) => Promise.resolve(kv.get(key) ?? null)),
      put: vi.fn((key: string, value: string) => {
        kv.set(key, value);
        return Promise.resolve();
      }),
    } as unknown as Env['CHALLENGES_KV'],
    R2: {
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(() => Promise.resolve()),
    } as unknown as Env['R2'],
    LEADERBOARD: {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ fetch: leaderboardFetch })),
    } as unknown as Env['LEADERBOARD'],
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET: '',
  };

  return { env, kv, leaderboardFetch };
}

describe('handleChallengeRequest', () => {
  beforeEach(() => {
    vi.mocked(validateResultScore).mockReturnValue(true);
  });

  describe('POST /api/challenge', () => {
    it('creates a challenge and stores it in KV', async () => {
      const { env, kv } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge', {
        method: 'POST',
        body: JSON.stringify(baseRequestBody),
      });

      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(200);

      const body = (await response.json()) as { id: string; url: string };
      expect(body.id).toMatch(/^[0-9A-Za-z]{6}$/);
      expect(body.url).toBe(`https://iknowthattune.com/?c=${body.id}`);

      const stored = JSON.parse(kv.get(`challenge:${body.id}`) ?? 'null') as Challenge;
      expect(stored.creator_name).toBe('Glen');
      expect(stored.id).toBe(body.id);
    });

    it('rejects challenges with no tracks', async () => {
      const { env } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge', {
        method: 'POST',
        body: JSON.stringify({ ...baseRequestBody, tracks: [] }),
      });

      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(400);
    });

    it('rejects challenges with more than 10 tracks', async () => {
      const { env } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge', {
        method: 'POST',
        body: JSON.stringify({ ...baseRequestBody, tracks: Array.from({ length: 11 }, (_, i) => `tk_${i}`) }),
      });

      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(400);
    });

    it('rejects an overly long challenge name', async () => {
      const { env } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge', {
        method: 'POST',
        body: JSON.stringify({ ...baseRequestBody, name: 'a'.repeat(51) }),
      });

      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(400);
    });

    it('rejects a profane creator name', async () => {
      const { env } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge', {
        method: 'POST',
        body: JSON.stringify({ ...baseRequestBody, creator_name: 'shit head' }),
      });

      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/challenge/:id', () => {
    it('returns 404 for an unknown challenge', async () => {
      const { env } = makeEnv();
      const request = new Request('https://iknowthattune.com/api/challenge/NOPE12');
      const response = await handleChallengeRequest(request, env);
      expect(response.status).toBe(404);
    });

    it('returns a previously created challenge', async () => {
      const { env } = makeEnv();
      const createResponse = await handleChallengeRequest(
        new Request('https://iknowthattune.com/api/challenge', {
          method: 'POST',
          body: JSON.stringify(baseRequestBody),
        }),
        env,
      );
      const { id } = (await createResponse.json()) as { id: string };

      const response = await handleChallengeRequest(
        new Request(`https://iknowthattune.com/api/challenge/${id}`),
        env,
      );
      expect(response.status).toBe(200);
      const challenge = (await response.json()) as Challenge;
      expect(challenge.id).toBe(id);
    });
  });

  describe('POST /api/challenge/:id/result', () => {
    const playerResult: PlayerResult = {
      playerId: 'player-2',
      playerName: 'Friend',
      score: 800,
      durationSeconds: 90,
      clipExtensions: 0,
    };

    it('returns 404 if the challenge does not exist', async () => {
      const { env } = makeEnv();
      const response = await handleChallengeRequest(
        new Request('https://iknowthattune.com/api/challenge/NOPE12/result', {
          method: 'POST',
          body: JSON.stringify(playerResult),
        }),
        env,
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 when the score fails validation', async () => {
      vi.mocked(validateResultScore).mockReturnValue(false);
      const { env } = makeEnv();
      const createResponse = await handleChallengeRequest(
        new Request('https://iknowthattune.com/api/challenge', {
          method: 'POST',
          body: JSON.stringify(baseRequestBody),
        }),
        env,
      );
      const { id } = (await createResponse.json()) as { id: string };

      const response = await handleChallengeRequest(
        new Request(`https://iknowthattune.com/api/challenge/${id}/result`, {
          method: 'POST',
          body: JSON.stringify(playerResult),
        }),
        env,
      );
      expect(response.status).toBe(400);
    });

    it('forwards a valid result to the Leaderboard Durable Object', async () => {
      const { env, leaderboardFetch } = makeEnv();
      const createResponse = await handleChallengeRequest(
        new Request('https://iknowthattune.com/api/challenge', {
          method: 'POST',
          body: JSON.stringify(baseRequestBody),
        }),
        env,
      );
      const { id } = (await createResponse.json()) as { id: string };

      const response = await handleChallengeRequest(
        new Request(`https://iknowthattune.com/api/challenge/${id}/result`, {
          method: 'POST',
          body: JSON.stringify(playerResult),
        }),
        env,
      );

      expect(response.status).toBe(200);
      expect(leaderboardFetch).toHaveBeenCalledTimes(1);
      expect(await response.json()).toEqual({ rank: 1 });
    });
  });

  describe('GET /api/challenge/:id/leaderboard', () => {
    it('returns the leaderboard from the Durable Object', async () => {
      const { env } = makeEnv();
      const response = await handleChallengeRequest(
        new Request('https://iknowthattune.com/api/challenge/ABC123/leaderboard'),
        env,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ rank: 1 });
    });
  });

  it('returns 404 for unrecognized routes', async () => {
    const { env } = makeEnv();
    const response = await handleChallengeRequest(new Request('https://iknowthattune.com/api/challenge/a/b/c'), env);
    expect(response.status).toBe(404);
  });
});
