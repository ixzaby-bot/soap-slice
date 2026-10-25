// Short, dry fractures: filtered texture and damped resonances, no noise loop.
export function makeCrunch(sampleRate: number, variant: number): Float32Array {
  const duration = .065;
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 937 + variant * 173, low = 0, body = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    low += (noise - low) * (1 - Math.exp(-2 * Math.PI * 1900 / sampleRate));
    body += (low - body) * (1 - Math.exp(-2 * Math.PI * 360 / sampleRate));
    const t = i / sampleRate;
    let value = 0;
    for (const offset of [0, .012 + variant * .0005, .029]) {
      const age = t - offset;
      if (age < 0) continue;
      const attack = Math.min(1, age / .0015);
      const decay = Math.exp(-age / (offset === 0 ? .009 : .005));
      const resonance = Math.sin(age * Math.PI * 2 * (480 + variant * 31)) * .24
        + Math.sin(age * Math.PI * 2 * (1130 + variant * 47)) * .09;
      value += attack * decay * (resonance + (low - body) * .65);
    }
    data[i] = Math.tanh(value * 1.5) * Math.min(1, (duration - t) / .008);
  }
  return data;
}
