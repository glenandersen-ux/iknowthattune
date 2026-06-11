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

  /** Fetches and decodes all clip durations for a track in parallel. */
  async preloadTrack(clipUrls: ClipUrlMap): Promise<void> {
    const entries = Object.entries(clipUrls) as [ClipDuration, string][];
    await Promise.all(
      entries.map(async ([duration, url]) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.clipCache.set(duration, audioBuffer);
      }),
    );
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
