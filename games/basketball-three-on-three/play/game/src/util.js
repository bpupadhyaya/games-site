export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = (a, b) => Math.hypot(a, b);
export const sgn = (v) => (v < 0 ? -1 : 1);
export function normal(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const angDiff = (a, b) => { let d = a - b; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; };
export const r2 = (v) => Math.round(v * 100) / 100;
