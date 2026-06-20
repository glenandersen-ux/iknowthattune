import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGlobalLeaderboardRequest } from './globalLeaderboard';
import type { Env } from '../env';

function makeEnv(kv: Map<string, string> = new Map()): Env {
  return {
    CHALLENGES_KV: {} as KVNamespace,
    AUTH_KV: {
      get: vi.fn((key: string) => Promise.resolve(kv.get(key) ?? null)),
      put: vi.fn((key: string, value: string, _opts?: unknown) => { kv.set(key, value); return Promise.resolve(); }),
      delete: vi.fn((key: string) => { kv.delete(key); return Promise.resolve(); }),
    } as unknown as KVNamespace,
    R2: {} as R2Bucket,
    LEADERBOARD: {} as DurableObjectNamespace,
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
  };
}

describe('handleGlobalLeaderboardRequest', () => {
  let kv: Map<string, string>;
  let env: Env;

  beforeEach(() => {
    kv = new Map();
    env = makeEnv(kv);
  });

  it('GET /daily returns an empty array when no scores exist', async () => {
    const res = await handleGlobalLeaderboardRequest(
      new Request('https://x.com/api/leaderboard/global?period=daily'),
      env,
    );
    expect(await res.json()).toEqual([]);
  });

  it('POST stores a score for an authenticated user', async () => {
    kv.set('session:tok1', 'u1');
    kv.set('user:u1', JSON.stringify({ display_name: 'Glen', avatar_url: null }));

    const res = await handleGlobalLeaderboardRequest(
      new Request('https://x.com/api/leaderboard/global', {
        method: 'POST',
        headers: { Cookie: 'iktt_session=tok1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 5000 }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
  });

  it('GET /daily returns the stored score after submission', async () => {
    kv.set('session:tok1', 'u1');
    kv.set('user:u1', JSON.stringify({ display_name: 'Glen', avatar_url: null }));

    await handleGlobalLeaderboardRequest(
      new Request('https://x.com/api/leaderboard/global', {
        method: 'POST',
        headers: { Cookie: 'iktt_session=tok1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 5000 }),
      }),
      env,
    );

    const res = await handleGlobalLeaderboardRequest(
      new Request('https://x.com/api/leaderboard/global?period=daily'),
      env,
    );
    const board = await res.json() as Array<{ display_name: string; score: number }>;
    expect(board).toHaveLength(1);
    expect(board[0].display_name).toBe('Glen');
    expect(board[0].score).toBe(5000);
  });

  it('does not update the board if the new score is lower', async () => {
    kv.set('session:tok1', 'u1');
    kv.set('user:u1', JSON.stringify({ display_name: 'Glen', avatar_url: null }));

    const submit = (score: number) =>
      handleGlobalLeaderboardRequest(
        new Request('https://x.com/api/leaderboard/global', {
          method: 'POST',
          headers: { Cookie: 'iktt_session=tok1', 'Content-Type': 'application/json' },
          body: JSON.stringify({ score }),
        }),
        env,
      );

    await submit(5000);
    const res = await submit(3000);
    expect((await res.json() as { updated: boolean }).updated).toBe(false);
  });

  it('POST returns 401 when not authenticated', async () => {
    const res = await handleGlobalLeaderboardRequest(
      new Request('https://x.com/api/leaderboard/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1000 }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });
});
