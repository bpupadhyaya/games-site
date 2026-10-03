export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = (a, b) => Math.sqrt(a * a + b * b);
export const sgn = (v) => (v < 0 ? -1 : 1);
export const r2 = (v) => Math.round(v * 100) / 100;
export const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// Gaussian from a seeded stream (Box-Muller); always consumes exactly two draws so streams stay aligned.
export function normal(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// erf approximation (Abramowitz-Stegun 7.1.26)
export function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
