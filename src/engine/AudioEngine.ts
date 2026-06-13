import type { ClipDuration, ClipUrlMap } from '../types/track';

/**
 * Wraps the Web Audio API to preload, play, and visualize track clips.
 *
 * The speed clock must read `engine.ctx.currentTime` (set by the caller when
 * `play()` resolves its start), never `Date.now()` — `currentTime` is immune
 * to tab-throttling and GC pauses (TechStack §D.5).
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private readonly analyser: AnalyserNode;
  private readonly gainNode: GainNode;
  private readonly clipCache: Map<ClipDuration, AudioBuffer> = new Map();

  constructor(ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.analyser = ctx.createAnalyser();
    this.gainNode = ctx.createGain();
  }

  /**
   * Fetches and decodes all clip durations for a track in parallel.
   *
   * Catalog tracks currently reuse the same preview URL for every duration,
   * so each distinct URL is fetched and decoded only once and the resulting
   * `AudioBuffer` is shared across all durations that reference it — issuing
   * 5 parallel requests for an identical URL was wasteful and made some CDNs
   * intermittently fail a subset of them, leaving individual durations
   * "not preloaded" even though the track as a whole loaded fine.
   *
   * Individual URL failures (e.g. an expired Spotify preview URL) are
   * tolerated as long as at least one URL loads successfully — the game can
   * still play with whatever durations are cached. Only throws if every URL
   * fails, so callers can surface a clear error instead of hanging
   * indefinitely.
   */
  async preloadTrack(clipUrls: ClipUrlMap): Promise<void> {
    const entries = Object.entries(clipUrls) as [ClipDuration, string][];
    const durationsByUrl = new Map<string, ClipDuration[]>();
    for (const [duration, url] of entries) {
      const durations = durationsByUrl.get(url);
      if (durations) {
        durations.push(duration);
      } else {
        durationsByUrl.set(url, [duration]);
      }
    }

    await Promise.allSettled(
      [...durationsByUrl.entries()].map(async ([url, durations]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Clip fetch failed for ${url}: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        for (const duration of durations) {
          this.clipCache.set(duration, audioBuffer);
        }
      }),
    );
    if (this.clipCache.size === 0) {
      throw new Error('Failed to preload any clip durations');
    }
  }

  /** Plays a preloaded clip duration, resolving when playback ends. */
  async play(duration: ClipDuration): Promise<void> {
    this.stop();
    const buffer = this.clipCache.get(duration);
    if (!buffer) throw new Error(`Clip ${duration} not preloaded`);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.sourceNode = source;

    return new Promise((resolve) => {
      source.onended = (): void => resolve();
      source.start();
    });
  }

  /** Returns the current time-domain waveform for visualization. */
  getWaveformData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /** Stops and disconnects the active source node, if any. */
  stop(): void {
    this.sourceNode?.stop();
    this.sourceNode?.disconnect();
    this.sourceNode = null;
  }

  /** Resumes a suspended AudioContext; required by iOS Safari before first playback. */
  unlock(): Promise<void> {
    return this.ctx.resume();
  }
}
