import type { Env } from '../env';

/** Routes `/api/daily` — KV-backed daily drop lookup. Reads `daily:YYYY-MM-DD` -> track ID. */
export async function handleDailyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const trackId = await env.CHALLENGES_KV.get(`daily:${date}`);
  if (trackId === null) {
    return new Response('No daily drop scheduled for this date', { status: 404 });
  }

  return Response.json({ date, trackId });
}
