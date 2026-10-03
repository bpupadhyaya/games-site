export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sgn = (v) => (v < 0 ? -1 : 1);
export const hyp = Math.hypot;
export const r2 = (v) => Math.round(v * 100) / 100;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// Gaussian from the seeded stream (Box-Muller); always consumes exactly two draws so streams stay aligned.
export function normal(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// distance from point (px,pz) to segment (ax,az)-(bx,bz); returns { d, u, x, z } with u in [0,1] along the segment
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let u = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const x = ax + dx * u, z = az + dz * u;
  return { d: Math.hypot(px - x, pz - z), u, x, z };
}
