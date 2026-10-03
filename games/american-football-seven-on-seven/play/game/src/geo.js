// Small geometry helpers shared by the sim files. Everything is in yards; x across, z along the field, y up.
import { FIELD } from './consts.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = Math.hypot;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
export const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// team 0 (the user) attacks +z, team 1 attacks -z
export const attackDir = (team) => (team === 0 ? 1 : -1);
export const goalZ = (team) => (team === 0 ? FIELD.EZ + FIELD.LEN : FIELD.EZ);          // the goal line a team attacks
export const ownGoalZ = (team) => (team === 0 ? FIELD.EZ : FIELD.EZ + FIELD.LEN);
export const ylOf = (team, z) => (team === 0 ? z - FIELD.EZ : FIELD.EZ + FIELD.LEN - z);   // yards from the team's own goal line (0..40 inside the field)
export const zOfYl = (team, yl) => (team === 0 ? FIELD.EZ + yl : FIELD.EZ + FIELD.LEN - yl);

// Box-Muller from the sim's rng (deterministic)
export function gauss(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// distance from point p to the segment a-b
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
