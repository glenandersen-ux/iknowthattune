import { describe, it, expect, vi } from 'vitest';
import { handleUgcRequest } from './ugc';
import type { Env } from '../env';
import type { Challenge } from '../../src/types/challenge';

const baseChallenge: Challenge = {
  id: 'ABC123',
  version: 1,
  created_at: Date.now(),
  creator_name: 'Glen',
  creator_player_id: 'player-1',
  creator_score: null,
  name: null,
  tracks: ['tk_queen_bohrhap'],
  active_params: {},
  clip_starts: {},
  settings: { time_pressure: 'standard', hints: 'none', expiry_ms: null, leaderboard_public: true },
  scoring: { first_guess_bonus: 500, clip_penalties: [100, 150, 200, 300], streak_multipliers: [1.1, 1.2, 1.35] },
};

function makeEnv(options: { challenge?: Challenge; objectExists?: boolean } = {}): {
  env: Env;
  kv: Map<string, string>;
  createPresignedUrl: ReturnType<typeof vi.fn>;
} {
  const kv = new Map<string, string>();
  if (options.challenge) {
    kv.set(`challenge:${options.challenge.id}`, JSON.stringify(options.challenge));
  }

  const createPresignedUrl = vi.fn((key: string) => Promise.resolve(`https://r2.example.com/${key}?signed=1`));
  const objectExists = options.objectExists ?? true;

  const env: Env = {
    CHALLENGES_KV: {
      get: vi.fn((key: string) => Promise.resolve(kv.get(key) ?? null)),
      put: vi.fn((key: string, value: string) => {
        kv.set(key, value);
        return Promise.resolve();
      }),
    } as unknown as Env['CHALLENGES_KV'],
    R2: {
      head: vi.fn(() => Promise.resolve(objectExists ? {} : null)),
      createPresignedUrl,
    } as unknown as Env['R2'],
    LEADERBOARD: {} as unknown as Env['LEADERBOARD'],
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    AUTH_KV: {} as KVNamespace,
  };

  return { env, kv, createPresignedUrl };
}

describe('handleUgcRequest', () => {
  describe('GET /api/ugc/presign', () => {
    it('returns 400 when challengeId or slot is missing', async () => {
      const { env } = makeEnv();
      const response = await handleUgcRequest(new Request('https://iknowthattune.com/api/ugc/presign'), env);
      expect(response.status).toBe(400);
    });

    it('returns a presigned upload URL and key', async () => {
      const { env, createPresignedUrl } = makeEnv();
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/presign?challengeId=ABC123&slot=0'),
        env,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { uploadUrl: string; key: string };
      expect(body.key).toBe('ugc-clips/ABC123/0.mp3');
      expect(body.uploadUrl).toContain('signed=1');
      expect(createPresignedUrl).toHaveBeenCalledWith('ugc-clips/ABC123/0.mp3', { method: 'PUT', expiresIn: 3600 });
    });
  });

  describe('GET /api/ugc/clip-url', () => {
    it('returns 400 when challengeId or slot is missing', async () => {
      const { env } = makeEnv();
      const response = await handleUgcRequest(new Request('https://iknowthattune.com/api/ugc/clip-url'), env);
      expect(response.status).toBe(400);
    });

    it('returns 404 when the clip does not exist in R2', async () => {
      const { env } = makeEnv({ objectExists: false });
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/clip-url?challengeId=ABC123&slot=0'),
        env,
      );
      expect(response.status).toBe(404);
    });

    it('returns a signed GET URL for an existing clip', async () => {
      const { env, createPresignedUrl } = makeEnv({ objectExists: true });
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/clip-url?challengeId=ABC123&slot=0'),
        env,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { url: string };
      expect(body.url).toContain('signed=1');
      expect(createPresignedUrl).toHaveBeenCalledWith('ugc-clips/ABC123/0.mp3', { method: 'GET', expiresIn: 3600 });
    });
  });

  describe('POST /api/ugc/confirm', () => {
    it('returns 400 when challengeId or slot is missing', async () => {
      const { env } = makeEnv();
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/confirm', { method: 'POST', body: JSON.stringify({}) }),
        env,
      );
      expect(response.status).toBe(400);
    });

    it('returns 404 when the challenge does not exist', async () => {
      const { env } = makeEnv();
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/confirm', {
          method: 'POST',
          body: JSON.stringify({ challengeId: 'NOPE12', slot: '0' }),
        }),
        env,
      );
      expect(response.status).toBe(404);
    });

    it('returns 404 when the clip has not been uploaded to R2', async () => {
      const { env } = makeEnv({ challenge: baseChallenge, objectExists: false });
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/confirm', {
          method: 'POST',
          body: JSON.stringify({ challengeId: 'ABC123', slot: '0' }),
        }),
        env,
      );
      expect(response.status).toBe(404);
    });

    it('marks the clip as active on the challenge and persists it to KV', async () => {
      const { env, kv } = makeEnv({ challenge: baseChallenge, objectExists: true });
      const response = await handleUgcRequest(
        new Request('https://iknowthattune.com/api/ugc/confirm', {
          method: 'POST',
          body: JSON.stringify({ challengeId: 'ABC123', slot: '0' }),
        }),
        env,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ key: 'ugc-clips/ABC123/0.mp3' });

      const updated = JSON.parse(kv.get('challenge:ABC123') ?? 'null') as Challenge;
      expect(updated.byoc_clips).toEqual({ '0': 'ugc-clips/ABC123/0.mp3' });
    });
  });

  it('returns 404 for unrecognized routes', async () => {
    const { env } = makeEnv();
    const response = await handleUgcRequest(new Request('https://iknowthattune.com/api/ugc/unknown'), env);
    expect(response.status).toBe(404);
  });
});
