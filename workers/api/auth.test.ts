import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAuthRequest } from './auth';
import type { Env } from '../env';

function makeEnv(kv: Map<string, string> = new Map()): Env {
  return {
    CHALLENGES_KV: {} as KVNamespace,
    AUTH_KV: {
      get: vi.fn((key: string) => Promise.resolve(kv.get(key) ?? null)),
      put: vi.fn((key: string, value: string, _opts?: { expirationTtl?: number }) => {
        kv.set(key, value);
        return Promise.resolve();
      }),
      delete: vi.fn((key: string) => { kv.delete(key); return Promise.resolve(); }),
    } as unknown as KVNamespace,
    R2: {} as R2Bucket,
    LEADERBOARD: {} as DurableObjectNamespace,
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET: '',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
  };
}

describe('handleAuthRequest', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 302 redirect to Google when starting OAuth', async () => {
    const env = makeEnv();
    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/google/start'),
      env,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('accounts.google.com');
    expect(response.headers.get('Location')).toContain('test-client-id');
  });

  it('returns 503 when Google credentials are not configured', async () => {
    const env = makeEnv();
    env.GOOGLE_CLIENT_ID = '';
    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/google/start'),
      env,
    );
    expect(response.status).toBe(503);
  });

  it('GET /api/auth/me returns null when no session cookie is set', async () => {
    const env = makeEnv();
    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/me'),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('GET /api/auth/me returns the user when a valid session exists', async () => {
    const kv = new Map<string, string>();
    const user = { user_id: 'u1', google_sub: 'g1', email: 'a@b.com', display_name: 'Glen', avatar_url: null, created_at: '2026-01-01' };
    kv.set('session:abc123', 'u1');
    kv.set('user:u1', JSON.stringify(user));
    const env = makeEnv(kv);

    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/me', { headers: { Cookie: 'iktt_session=abc123' } }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { display_name: string };
    expect(body.display_name).toBe('Glen');
  });

  it('POST /api/auth/logout clears the session and sets an expiring cookie', async () => {
    const kv = new Map([['session:tok1', 'u1']]);
    const env = makeEnv(kv);

    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/logout', { method: 'POST', headers: { Cookie: 'iktt_session=tok1' } }),
      env,
    );
    expect(response.status).toBe(200);
    expect(kv.has('session:tok1')).toBe(false);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('returns 204 for OPTIONS preflight', async () => {
    const response = await handleAuthRequest(
      new Request('https://iknowthattune.com/api/auth/me', { method: 'OPTIONS' }),
      makeEnv(),
    );
    expect(response.status).toBe(204);
  });
});
