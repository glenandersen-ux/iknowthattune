import type { Env } from '../env';

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  timestamp: string;
}

const TOP_N = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function todayKey(): string {
  return `gboard:d:${new Date().toISOString().slice(0, 10)}`;
}

function dayKey(date: Date): string {
  return `gboard:d:${date.toISOString().slice(0, 10)}`;
}

function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  return cookie.match(/(?:^|;\s*)iktt_session=([^;]+)/)?.[1] ?? null;
}

async function readBoard(env: Env, key: string): Promise<LeaderboardEntry[]> {
  const raw = await env.AUTH_KV.get(key);
  if (!raw) return [];
  try { return JSON.parse(raw) as LeaderboardEntry[]; } catch { return []; }
}

function mergeAndSort(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  // Keep only the best score per user, then take top N.
  const best = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    const existing = best.get(entry.user_id);
    if (!existing || entry.score > existing.score) best.set(entry.user_id, entry);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, TOP_N);
}

/** GET /api/leaderboard/global?period=daily|weekly */
async function handleGet(request: Request, env: Env): Promise<Response> {
  const period = new URL(request.url).searchParams.get('period') ?? 'daily';

  if (period === 'daily') {
    const entries = await readBoard(env, todayKey());
    return new Response(JSON.stringify(entries), { headers: CORS });
  }

  // Weekly: merge the last 7 days.
  const now = new Date();
  const fetches = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    return readBoard(env, dayKey(d));
  });
  const all = (await Promise.all(fetches)).flat();
  return new Response(JSON.stringify(mergeAndSort(all)), { headers: CORS });
}

/** POST /api/leaderboard/global — authenticated; body: { score } */
async function handleSubmit(request: Request, env: Env): Promise<Response> {
  const token = getSessionToken(request);
  if (!token) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: CORS });

  const userId = await env.AUTH_KV.get(`session:${token}`);
  if (!userId) return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: CORS });

  const userRaw = await env.AUTH_KV.get(`user:${userId}`);
  if (!userRaw) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: CORS });
  const user = JSON.parse(userRaw) as { display_name: string; avatar_url: string | null };

  const { score } = (await request.json()) as { score: number };
  if (typeof score !== 'number' || score < 0) {
    return new Response(JSON.stringify({ error: 'Invalid score' }), { status: 400, headers: CORS });
  }

  const key = todayKey();
  const board = await readBoard(env, key);

  const newEntry: LeaderboardEntry = {
    user_id: userId,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    score,
    timestamp: new Date().toISOString(),
  };

  // Replace existing entry for this user if the new score is higher.
  const existing = board.findIndex((e) => e.user_id === userId);
  if (existing >= 0) {
    if (score <= board[existing].score) {
      return new Response(JSON.stringify({ ok: true, updated: false }), { headers: CORS });
    }
    board.splice(existing, 1);
  }

  board.push(newEntry);
  const sorted = mergeAndSort(board);

  // TTL: keep daily board for 8 days so weekly view covers the full 7-day window.
  await env.AUTH_KV.put(key, JSON.stringify(sorted), { expirationTtl: 8 * 24 * 60 * 60 });

  return new Response(JSON.stringify({ ok: true, updated: true }), { headers: CORS });
}

export async function handleGlobalLeaderboardRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'GET') return handleGet(request, env);
  if (request.method === 'POST') return handleSubmit(request, env);
  return new Response('Method not allowed', { status: 405, headers: CORS });
}
