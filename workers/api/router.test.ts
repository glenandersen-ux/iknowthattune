import { describe, it, expect, vi } from 'vitest';
import type { Env } from '../env';

vi.mock('./challenge', () => ({
  handleChallengeRequest: vi.fn(() => Promise.resolve(new Response('challenge'))),
}));
vi.mock('./daily', () => ({
  handleDailyRequest: vi.fn(() => Promise.resolve(new Response('daily'))),
}));
vi.mock('./ugc', () => ({
  handleUgcRequest: vi.fn(() => Promise.resolve(new Response('ugc'))),
}));

const env = {} as Env;

describe('router', () => {
  it('routes /api/daily to handleDailyRequest', async () => {
    const router = (await import('./router')).default;
    const response = await router.fetch(new Request('https://iknowthattune.com/api/daily'), env);
    expect(await response.text()).toBe('daily');
  });

  it('routes /api/ugc/* to handleUgcRequest', async () => {
    const router = (await import('./router')).default;
    const response = await router.fetch(new Request('https://iknowthattune.com/api/ugc/presign'), env);
    expect(await response.text()).toBe('ugc');
  });

  it('routes /api/challenge/* to handleChallengeRequest', async () => {
    const router = (await import('./router')).default;
    const response = await router.fetch(new Request('https://iknowthattune.com/api/challenge/ABC123'), env);
    expect(await response.text()).toBe('challenge');
  });

  it('returns 404 for unknown routes', async () => {
    const router = (await import('./router')).default;
    const response = await router.fetch(new Request('https://iknowthattune.com/api/nope'), env);
    expect(response.status).toBe(404);
  });
});
