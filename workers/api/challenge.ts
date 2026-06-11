import type { Env } from '../env';
import type { Challenge, CreateChallengeRequest, PlayerResult } from '../../src/types/challenge';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Generates a collision-resistant 6-char base62 challenge ID (TechStack §D.10). */
function generateChallengeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const view = new DataView(bytes.buffer);
  let n = view.getUint32(0);

  let id = '';
  for (let i = 0; i < 6; i++) {
    id = BASE62[n % 62] + id;
    n = Math.floor(n / 62);
  }
  return id;
}

async function createChallenge(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as CreateChallengeRequest;

  if (body.tracks.length < 1 || body.tracks.length > 10) {
    return new Response('Challenge must contain 1-10 tracks', { status: 400 });
  }

  let id = generateChallengeId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await env.CHALLENGES_KV.get(`challenge:${id}`);
    if (existing === null) break;
    id = generateChallengeId();
  }

  const challenge: Challenge = { ...body, id, version: 1, created_at: Date.now() };

  await env.CHALLENGES_KV.put(`challenge:${id}`, JSON.stringify(challenge), {
    expirationTtl: 60 * 60 * 24 * 90,
  });

  return Response.json({ id, url: `https://iknowthattune.com/?c=${id}` });
}

async function getChallenge(id: string, env: Env): Promise<Response> {
  const data = await env.CHALLENGES_KV.get(`challenge:${id}`);
  if (data === null) return new Response('Not found', { status: 404 });
  return Response.json(JSON.parse(data) as Challenge);
}

async function submitResult(id: string, request: Request, env: Env): Promise<Response> {
  const challengeData = await env.CHALLENGES_KV.get(`challenge:${id}`);
  if (challengeData === null) return new Response('Challenge not found', { status: 404 });

  const result = (await request.json()) as PlayerResult;
  const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName(id));
  const response = await stub.fetch('https://leaderboard/submit', {
    method: 'POST',
    body: JSON.stringify(result),
  });

  return new Response(response.body, response);
}

async function getLeaderboard(id: string, env: Env): Promise<Response> {
  const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName(id));
  const response = await stub.fetch('https://leaderboard/');
  return new Response(response.body, response);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    // POST /api/challenge
    if (request.method === 'POST' && segments.length === 2 && segments[1] === 'challenge') {
      return createChallenge(request, env);
    }

    // GET /api/challenge/:id
    if (request.method === 'GET' && segments.length === 3 && segments[1] === 'challenge') {
      return getChallenge(segments[2] as string, env);
    }

    // POST /api/challenge/:id/result
    if (
      request.method === 'POST' &&
      segments.length === 4 &&
      segments[1] === 'challenge' &&
      segments[3] === 'result'
    ) {
      return submitResult(segments[2] as string, request, env);
    }

    // GET /api/challenge/:id/leaderboard
    if (
      request.method === 'GET' &&
      segments.length === 4 &&
      segments[1] === 'challenge' &&
      segments[3] === 'leaderboard'
    ) {
      return getLeaderboard(segments[2] as string, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
