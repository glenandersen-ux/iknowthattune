import type { Env } from '../env';
import { handleChallengeRequest } from './challenge';
import { handleDailyRequest } from './daily';
import { handleUgcRequest } from './ugc';
import { handleSpotifyRequest } from './spotify';
import { handleDeezerRequest } from './deezer';
import { handleAuthRequest } from './auth';

export { LeaderboardDO } from '../durable-objects/Leaderboard';

/**
 * Single Worker entry point for all `/api/*` routes. Cloudflare Pages forwards
 * `/api/*` here via a service binding (`functions/api/[[path]].ts`), so this
 * router must cover every `workers/api/*` module.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    if (segments[1] === 'daily') return handleDailyRequest(request, env);
    if (segments[1] === 'ugc') return handleUgcRequest(request, env);
    if (segments[1] === 'challenge') return handleChallengeRequest(request, env);
    if (segments[1] === 'spotify') return handleSpotifyRequest(request, env);
    if (segments[1] === 'deezer') return handleDeezerRequest(request, env);
    if (segments[1] === 'auth') return handleAuthRequest(request, env);

    return new Response('Not found', { status: 404 });
  },
};
