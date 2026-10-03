// Pure helpers shared by the simulation, the AI and the HUD: geometry, ball prediction, the kick model.
import { HW, HL, ZG, GHW, BHW, G, REACH, JUMP_APEX, ATTR } from './consts.js';
import { clamp, hyp, erf } from './util.js';

export const dirOf = (team) => (team === 0 ? 1 : -1);          // team 0 attacks +z, team 1 attacks -z
export const goalZ = (team) => dirOf(team) * ZG;               // the goal line a team kicks at
export const inside = (x, z, m = 0) => (x * x) / ((HW - m) * (HW - m)) + (z * z) / ((HL - m) * (HL - m)) <= 1;
export function clampPitch(p, m = 0.5) {
  const a = HW - m, b = HL - m, k = (p.x * p.x) / (a * a) + (p.z * p.z) / (b * b);
  if (k > 1) { const f = 1 / Math.sqrt(k); p.x *= f; p.z *= f; }
}
// where the ball crosses the boundary between (x0,z0) inside and (x1,z1) outside (bisection)
export function exitPoint(x0, z0, x1, z1) {
  let a = 0, b = 1;
  for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (inside(x0 + (x1 - x0) * m, z0 + (z1 - z0) * m)) a = m; else b = m; }
  return { x: x0 + (x1 - x0) * a, z: z0 + (z1 - z0) * a };
}
export const faceVec = (p) => ({ x: Math.sin(p.face), z: Math.cos(p.face) });
export const yawOf = (dx, dz) => Math.atan2(dx, dz);
// height the hands reach (m) for a player now
export const jumpH = (p) => (p.jt >= 0 && p.jt < 2 * JUMP_APEX ? ATTR[p.slot].leap * (1 - Math.pow((p.jt - JUMP_APEX) / JUMP_APEX, 2)) : 0);

// ball flight with gravity only (no bounce): positions each `dt` until the ball comes down to y <= 0.3 or n steps
export function predictBall(b, n = 240, dt = 1 / 30) {
  const out = []; let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  for (let i = 1; i <= n; i++) {
    vy -= G * dt; x += vx * dt; y += vy * dt; z += vz * dt;
    out.push({ t: i * dt, x, y, z });
    if (y <= 0.3 && vy < 0) break;
  }
  return out;
}
// launch for a kick from (h0) to horizontal distance D landing at height ht: returns { speed, elev, T }
export function kickSolve(D, h0 = 0.65, ht = 2.5, maxV = 27) {
  const elev = clamp((14 + D * 0.5) * Math.PI / 180, 16 * Math.PI / 180, 40 * Math.PI / 180);
  const dh = ht - h0, c = Math.cos(elev), t = Math.tan(elev);
  let den = 2 * c * c * (D * t - dh);
  if (den < 0.5) den = 0.5;
  let v = Math.sqrt((G * D * D) / den);
  v = clamp(v, 8, maxV);
  return { speed: v, elev, T: D / (v * c) };
}
// angular standard deviation (rad) of a disposal
export function kickSigma(aim, dist, pressure, moving) {
  const base = 7.4 * (1.75 - aim);                       // degrees at no pressure, short range
  const deg = base * (1 + 0.55 * dist / 30) * (1 + 0.7 * pressure) * (1 + 0.15 * moving);
  return deg * Math.PI / 180;
}
export const GOAL_SIGMA = 1.85;   // shots at goal are harder than passes: the posts are a small target
export function goalChance(x, z, team, aim, pressure = 0) {
  const gz = goalZ(team), D = hyp(x, gz - z);
  if (D > 46) return 0;
  const sig = kickSigma(aim, D, pressure, 0) * GOAL_SIGMA, s = D * Math.tan(sig);
  const pGoal = erf(GHW / (s * Math.SQRT2));
  const pReach = D < 36 ? 1 : clamp(1 - (D - 36) / 12, 0.1, 1);
  return pGoal * pReach;
}
export function nearestOpp(players, p, team, x = p.x, z = p.z) {
  let best = 99, id = -1;
  for (const o of players) if (o.team !== team) { const d = hyp(o.x - x, o.z - z); if (d < best) { best = d; id = o.id; } }
  return { d: best, id };
}
export const pressureOf = (players, p) => {
  let m = 99;
  for (const o of players) if (o.team !== p.team && o.st !== 'down') { const d = hyp(o.x - p.x, o.z - p.z); if (d < m) m = d; }
  return clamp((3.0 - m) / 2.0, 0, 1);
};
export { REACH, GHW, BHW, ZG };
