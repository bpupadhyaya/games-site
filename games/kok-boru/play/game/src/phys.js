// Ball flight and throw maths shared by the simulation, the AI, the Think hint and the aiming preview. Pure.
import { G, THROW_ANG, GOAL_R, DROP_R, GOAL_X } from './consts.js';
import { clamp, hyp } from './util.js';

export const THROW_Y = 1.5;
// launch speed for a charge p in [0,1]
export const launchSpeed = (p) => 5 + 17 * clamp(p, 0, 1);
// horizontal range of a throw with charge p from height y0
export function rangeFor(p, y0 = THROW_Y) {
  const v = launchSpeed(p), vh = v * Math.cos(THROW_ANG), vy = v * Math.sin(THROW_ANG);
  const t = (vy + Math.sqrt(vy * vy + 2 * G * y0)) / G;
  return { d: vh * t, t, vh, vy };
}
// the charge that lands the ball d metres away (bisection)
export function powerFor(d, y0 = THROW_Y) {
  let lo = 0, hi = 1;
  if (rangeFor(0, y0).d >= d) return 0;
  if (rangeFor(1, y0).d <= d) return 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (rangeFor(m, y0).d < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// where a free ball will first touch the ground (ground-level balls: where it stops rolling)
export function landing(b) {
  if (b.y < 0.05 && Math.abs(b.vy) < 0.5) {
    const sp = hyp(b.vx, b.vz), run = sp > 0.01 ? (sp * sp) / (2 * 5) : 0;
    return { x: b.x + (b.vx / (sp || 1)) * run, z: b.z + (b.vz / (sp || 1)) * run, t: sp / 5, air: false };
  }
  const t = (b.vy + Math.sqrt(b.vy * b.vy + 2 * G * Math.max(b.y, 0))) / G;
  return { x: b.x + b.vx * t, z: b.z + b.vz * t, t, air: true };
}
export const goalCentre = (team) => ({ x: team === 0 ? GOAL_X : -GOAL_X, z: 0 });
export const inGoalCircle = (x, z, team) => { const g = goalCentre(team); return hyp(x - g.x, z - g.z) <= GOAL_R; };
// Solve the throw that lands at (gx, gz) for a rider moving at (vx, vy): his speed carries half over to the ball, so both the charge and
// the direction are compensated. Returns { p, ang, d }.
export function solveThrow(x, z, vx, vz, gx, gz, y0 = THROW_Y) {
  let p = powerFor(hyp(gx - x, gz - z), y0), ang = 0, d = 0;
  for (let i = 0; i < 8; i++) {
    const t = rangeFor(p, y0).t;
    const dx = gx - x - 0.5 * vx * t, dz = gz - z - 0.5 * vz * t;
    d = Math.max(0.3, hyp(dx, dz)); ang = Math.atan2(dz, dx);
    p = powerFor(d, y0);
  }
  return { p, ang, d };
}
// the throw a carrier would make with charge p toward the attacked circle (or heading `dirAngle`)
export function throwPlan(r, p, dirAngle, team) {
  const g = goalCentre(team);
  const dx = g.x - r.x, dz = g.z - r.z, dg = hyp(dx, dz);
  const drop = dg <= DROP_R && hyp(r.vx, r.vz) < 6.2;
  const sol = solveThrow(r.x, r.z, r.vx, r.vz, g.x, g.z);
  const pe = drop ? sol.p : clamp(p, 0, 1);
  const rg = rangeFor(pe);
  // the direction that, for THIS charge, cancels the rider's sideways drift (so only the power decides length)
  const Dx = dx - 0.5 * r.vx * rg.t, Dz = dz - 0.5 * r.vz * rg.t;
  const ang = dirAngle == null ? Math.atan2(Dz, Dx) : dirAngle;
  return { ang, p: pe, d: rg.d, t: rg.t, vh: rg.vh, vy: rg.vy, drop, need: sol.p, dist: dg, goalAng: Math.atan2(dz, dx),
    lx: r.x + Math.cos(ang) * rg.d + r.vx * 0.5 * rg.t, lz: r.z + Math.sin(ang) * rg.d + r.vz * 0.5 * rg.t };
}
