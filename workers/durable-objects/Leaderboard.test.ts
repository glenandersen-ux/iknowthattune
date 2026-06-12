import { describe, it, expect } from 'vitest';
import { LeaderboardDO } from './Leaderboard';
import type { PlayerResult } from '../../src/types/challenge';

/** In-memory stand-in for `DurableObjectStorage`, covering only `get`/`put`. */
function makeState(): DurableObjectState {
  const data = new Map<string, unknown>();
  return {
    storage: {
      get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
      put: (key: string, value: unknown) => {
        data.set(key, value);
        return Promise.resolve();
      },
    },
  } as unknown as DurableObjectState;
}

function submit(playerId: string, score: number, durationSeconds: number): PlayerResult {
  return { playerId, playerName: playerId, score, durationSeconds, clipExtensions: 0 };
}

describe('LeaderboardDO', () => {
  it('returns an empty leaderboard initially', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    const response = await leaderboard.fetch(new Request('https://leaderboard/'));
    expect(await response.json()).toEqual([]);
  });

  it('adds a new entry and returns its rank', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    const response = await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('alice', 1000, 60)) }),
    );
    expect(await response.json()).toEqual({ rank: 1 });
  });

  it('ranks entries by score descending, then duration ascending', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('alice', 1000, 60)) }),
    );
    await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('bob', 2000, 90)) }),
    );
    const response = await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('carol', 1000, 30)) }),
    );
    expect(await response.json()).toEqual({ rank: 2 });

    const entries = (await (
      await leaderboard.fetch(new Request('https://leaderboard/'))
    ).json()) as PlayerResult[];
    expect(entries.map((e) => e.playerId)).toEqual(['bob', 'carol', 'alice']);
  });

  it('keeps the best score when the same player submits twice, and ignores a worse retry', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('alice', 1000, 60)) }),
    );
    await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('alice', 500, 60)) }),
    );
    await leaderboard.fetch(
      new Request('https://leaderboard/submit', { method: 'POST', body: JSON.stringify(submit('alice', 1500, 60)) }),
    );

    const entries = (await (
      await leaderboard.fetch(new Request('https://leaderboard/'))
    ).json()) as PlayerResult[];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.score).toBe(1500);
  });

  it('truncates to the top 100 entries', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    for (let i = 0; i < 105; i++) {
      await leaderboard.fetch(
        new Request('https://leaderboard/submit', {
          method: 'POST',
          body: JSON.stringify(submit(`player-${i}`, i, 60)),
        }),
      );
    }

    const entries = (await (
      await leaderboard.fetch(new Request('https://leaderboard/'))
    ).json()) as PlayerResult[];
    expect(entries).toHaveLength(100);
    expect(entries[0]?.score).toBe(104);
  });

  it('returns 404 for unknown routes', async () => {
    const leaderboard = new LeaderboardDO(makeState());
    const response = await leaderboard.fetch(new Request('https://leaderboard/nope'));
    expect(response.status).toBe(404);
  });
});
