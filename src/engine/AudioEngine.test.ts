import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from './AudioEngine';
import type { ClipUrlMap } from '../types/track';

class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAnalyserNode {
  frequencyBinCount = 32;
  connect = vi.fn();
  getByteTimeDomainData = vi.fn();
}

class MockGainNode {
  connect = vi.fn();
}

class MockAudioContext {
  destination = {};
  currentTime = 0;
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createGain = vi.fn(() => new MockGainNode());
  decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
  resume = vi.fn(async () => undefined);
}

const CLIP_URLS: ClipUrlMap = {
  '1s': 'https://example.com/1s.mp3',
  '3s': 'https://example.com/3s.mp3',
  '5s': 'https://example.com/5s.mp3',
  '10s': 'https://example.com/10s.mp3',
  '30s': 'https://example.com/30s.mp3',
};

describe('AudioEngine', () => {
  let ctx: MockAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    ctx = new MockAudioContext();
    engine = new AudioEngine(ctx as unknown as AudioContext);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
    );
  });

  it('preloadTrack decodes each clip URL exactly once', async () => {
    await engine.preloadTrack(CLIP_URLS);
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(5);
  });

  it('play resolves after the source node fires onended', async () => {
    await engine.preloadTrack(CLIP_URLS);
    const playPromise = engine.play('1s');

    const source = ctx.createBufferSource.mock.results[0]?.value as MockAudioBufferSourceNode;
    expect(source.start).toHaveBeenCalled();

    source.onended?.();
    await expect(playPromise).resolves.toBeUndefined();
  });

  it('play throws if the clip duration was not preloaded', async () => {
    await expect(engine.play('1s')).rejects.toThrow('Clip 1s not preloaded');
  });

  it('preloadTrack tolerates individual clip failures as long as one succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('30s')
          ? Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
          : Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
      ),
    );

    await expect(engine.preloadTrack(CLIP_URLS)).resolves.toBeUndefined();
    await expect(engine.play('30s')).rejects.toThrow('Clip 30s not preloaded');
  });

  it('preloadTrack throws if every clip duration fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
    );

    await expect(engine.preloadTrack(CLIP_URLS)).rejects.toThrow('Failed to preload any clip durations');
  });

  it('stop disconnects the active source node', async () => {
    await engine.preloadTrack(CLIP_URLS);
    const playPromise = engine.play('1s');
    const source = ctx.createBufferSource.mock.results[0]?.value as MockAudioBufferSourceNode;

    engine.stop();

    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();

    source.onended?.();
    await playPromise;
  });
});
