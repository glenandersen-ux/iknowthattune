import { describe, it, expect } from 'vitest';
import { buildDailyKey, buildSeedDailyArgs, KV_BINDING } from './seed-daily';

describe('buildDailyKey', () => {
  it('namespaces a date under daily:', () => {
    expect(buildDailyKey('2026-06-10')).toBe('daily:2026-06-10');
  });
});

describe('buildSeedDailyArgs', () => {
  it('builds a local wrangler kv key put command', () => {
    const args = buildSeedDailyArgs('2026-06-10', 'tk_queen_bohrhap', true);
    expect(args).toEqual([
      'kv',
      'key',
      'put',
      `--binding=${KV_BINDING}`,
      'daily:2026-06-10',
      'tk_queen_bohrhap',
      '--local',
    ]);
  });

  it('builds a remote wrangler kv key put command', () => {
    const args = buildSeedDailyArgs('2026-06-10', 'tk_queen_bohrhap', false);
    expect(args).toEqual([
      'kv',
      'key',
      'put',
      `--binding=${KV_BINDING}`,
      'daily:2026-06-10',
      'tk_queen_bohrhap',
      '--remote',
    ]);
  });
});
