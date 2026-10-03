export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sgn = (v) => (v < 0 ? -1 : 1);
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// Gaussian from the seeded stream (Box-Muller). Always consumes exactly two draws so streams stay aligned.
export function normal(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const r2 = (v) => Math.round(v * 100) / 100;
export const smooth = (u) => u * u * (3 - 2 * u);
