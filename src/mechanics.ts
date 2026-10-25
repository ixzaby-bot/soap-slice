export const STROKE_LIMIT = 0.105;
// Frame-rate independent smoothing; finish the tiny tail instead of cutting forever.
export function smoothCut(pending: number, dt: number): number {
  return pending < .00008 ? pending : pending * (1 - Math.exp(-26 * Math.max(0, dt)));
}
export function cutAmount(deltaY: number, viewport: number, used: number, progress: number): number {
  return Math.max(0, Math.min(Math.max(0, deltaY) / Math.max(160, viewport) * .32, STROKE_LIMIT - used, 1 - progress));
}
export function soapHeight(progress: number): number { return 1.6 - Math.min(1, Math.max(0, progress)) * 1.48; }
export function randomSeed(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
