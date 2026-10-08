// Analytic ball flights. A flight is { t0, x, y, z, vx, vy, vz }: position at time t is p0 + v0*dt - g*dt^2/2 (y only).
import { G, BR, BR_PLAY, NET_BOTTOM } from './consts.js';

export const posAt = (f, t) => { const d = t - f.t0; return { x: f.x + f.vx * d, y: f.y + f.vy * d - 0.5 * G * d * d, z: f.z + f.vz * d }; };
export const velAt = (f, t) => { const d = t - f.t0; return { x: f.vx, y: f.vy - G * d, z: f.vz }; };
export const speedAt = (f, t) => { const v = velAt(f, t); return Math.hypot(v.x, v.y, v.z); };

// Flight from p0 at t0 that reaches p1 exactly T seconds later.
export function flightTo(t0, p0, p1, T) {
  return { t0, x: p0.x, y: p0.y, z: p0.z, vx: (p1.x - p0.x) / T, vz: (p1.z - p0.z) / T, vy: (p1.y - p0.y) / T + 0.5 * G * T };
}
// Time at which the ball (descending) reaches height h after t0, or null.
export function timeAtHeight(f, h, descending = true) {
  const a = -0.5 * G, b = f.vy, c = f.y - h;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b + s) / (2 * a), t2 = (-b - s) / (2 * a);       // a < 0 so t2 >= t1
  const d = descending ? Math.max(t1, t2) : Math.min(t1, t2);
  return d >= 0 ? f.t0 + d : null;
}
export const landTime = (f) => timeAtHeight(f, BR, true);
// First time after t0 the ball crosses z = 0, or null.
export function netTime(f, tEnd) {
  if (Math.abs(f.vz) < 1e-6) return null;
  const d = -f.z / f.vz;
  if (d <= 1e-9) return null;
  const t = f.t0 + d;
  return t <= tEnd ? t : null;
}
export const apexTime = (f) => (f.vy > 0 ? f.t0 + f.vy / G : f.t0);
// Height of the flight when it crosses the net plane, given launch point and target (used to size a shot)
export function netClearance(p0, p1, T) {
  const f = flightTo(0, p0, p1, T);
  const tn = netTime(f, T);
  if (tn === null) return null;
  const p = posAt(f, tn);
  return { t: tn, x: p.x, y: p.y };
}
export const NET_LOW = NET_BOTTOM - BR_PLAY;
