import { makeCrunch } from './crunch';

export class ShavingAudio {
  enabled = true;
  private context?: AudioContext;
  private output?: DynamicsCompressorNode;
  private buffers: AudioBuffer[] = [];
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private nextGrain = 0;
  private distance = 0;
  private variation = 0;

  async unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const Audio = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!Audio) throw new Error('Audio is unavailable');
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) { try { session.type = 'playback'; } catch { /* Optional API. */ } }
      this.context = new Audio({ latencyHint: 'interactive' });
      const ctx = this.context;
      this.output = ctx.createDynamicsCompressor();
      this.output.threshold.value = -15; this.output.ratio.value = 3;
      this.output.connect(ctx.destination);
      for (let i = 0; i < 6; i++) {
        const samples = makeCrunch(ctx.sampleRate, i);
        const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.getChannelData(0).set(samples); this.buffers.push(buffer);
      }
    }
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio did not resume');
  }

  scrape(speed: number, amount: number) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    this.distance = Math.min(.012, this.distance + amount);
    // One cluster per distance, capped at ~11/s. Independent of chip count.
    // No scheduled backlog and no burst of catch-up sounds after a slow frame.
    if (this.distance < .004 || this.context.currentTime < this.nextGrain) return;
    this.distance = 0;
    this.play(Math.min(1, speed / 850));
  }

  private play(speed: number) {
    const ctx = this.context;
    if (!ctx || !this.output || this.voices.size >= 2) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    const index = this.variation++ % this.buffers.length;
    source.buffer = this.buffers[index];
    source.playbackRate.value = .92 + (index % 3) * .055 + speed * .08;
    gain.gain.value = .32 + speed * .16;
    source.connect(gain).connect(this.output);
    const voice = { source, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(t);
    this.nextGrain = t + .09 + (index % 3) * .011;
  }

  preview() { if (this.enabled) this.play(.45); }
  stop() {
    this.distance = 0;
    if (!this.context) return;
    const t = this.context.currentTime;
    for (const voice of this.voices) {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, .004);
      voice.source.stop(t + .025);
    }
  }
}
