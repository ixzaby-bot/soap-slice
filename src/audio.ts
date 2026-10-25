export class ShavingAudio {
  enabled = true;
  private context?: AudioContext;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  async unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const Audio = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!Audio) throw new Error('Audio is unavailable');
      // Safari normally treats Web Audio as ambient audio. Request media playback
      // when available, so the mute switch does not silently suppress the game.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) { try { session.type = 'playback'; } catch { /* Optional API. */ } }
      this.context = new Audio({ latencyHint: 'interactive' });
      const ctx = this.context;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < data.length; i++) { const n = Math.random() * 2 - 1; low = (low + n * .12) / 1.12; data[i] = (n * .55 + low * 1.5) * (.65 + .35 * Math.sin(i * .034)); }
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'bandpass'; this.filter.Q.value = .65;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 5;
      source.connect(this.filter).connect(this.gain).connect(limiter).connect(ctx.destination); source.start();
    }
    // iOS can also enter "interrupted" after backgrounding or a phone call.
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio did not resume');
  }
  scrape(speed: number) {
    if (!this.enabled || !this.context || !this.gain || !this.filter) return;
    const t = this.context.currentTime, v = Math.min(1, speed / 900);
    this.filter.frequency.setTargetAtTime(850 + v * 2200, t, .015);
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(.13 + v * .32, t, .008);
    this.gain.gain.setTargetAtTime(0, t + .035, .018);
  }
  preview() { this.scrape(500); }
  stop() { if (this.context && this.gain) { const t = this.context.currentTime; this.gain.gain.cancelScheduledValues(t); this.gain.gain.setTargetAtTime(0, t, .012); } }
}
