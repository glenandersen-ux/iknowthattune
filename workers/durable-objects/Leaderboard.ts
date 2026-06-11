import type { PlayerResult } from '../../src/types/challenge';

/**
 * Per-challenge leaderboard. Durable Objects (not KV) are used here because
 * KV's eventual consistency can drop or duplicate entries under concurrent
 * submissions (TechStack §D.7).
 */
export class LeaderboardDO implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/submit') {
      return this.submit(request);
    }

    if (request.method === 'GET' && url.pathname === '/') {
      const entries = await this.getEntries();
      return Response.json(entries);
    }

    return new Response('Not found', { status: 404 });
  }

  private async getEntries(): Promise<PlayerResult[]> {
    return (await this.state.storage.get<PlayerResult[]>('entries')) ?? [];
  }

  private async submit(request: Request): Promise<Response> {
    const result = (await request.json()) as PlayerResult;
    const entries = await this.getEntries();

    const existingIndex = entries.findIndex((entry) => entry.playerId === result.playerId);
    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      if (existing !== undefined && result.score > existing.score) {
        entries[existingIndex] = result;
      }
    } else {
      entries.push(result);
    }

    entries.sort((a, b) => b.score - a.score || a.durationSeconds - b.durationSeconds);

    const top = entries.slice(0, 100);
    await this.state.storage.put('entries', top);

    const rank = top.findIndex((entry) => entry.playerId === result.playerId) + 1;
    return Response.json({ rank });
  }
}
