// The javelin's launch maths, shared by the simulation (release) and the HUD (the arc preview), so the preview is the real flight.
import { GRAV, V_THROW, HAND_Y, MARK_Y, flightTime, LANES, WIND_TICKS, DT } from './consts.js';
const hyp = Math.hypot;

// hand position at release for a rider at (x, z) heading dir
export const handAt = (x, z, dir) => ({ x: x + 0.25, y: HAND_Y, z: z + dir * 0.55 });
// launch velocity so the javelin passes P; rv = the rider's own velocity (it adds to the throw); capped by the arm (V_THROW)
export function solveThrow(O, rv, P) {
  const dist = hyp(P.x - O.x, P.z - O.z), T = flightTime(dist);
  let vx = (P.x - O.x) / T, vz = (P.z - O.z) / T, vy = (P.y - O.y) / T + 0.5 * GRAV * T;
  let ux = vx - rv.x, uy = vy, uz = vz - rv.z, short = false;
  const sp = hyp(ux, uy, uz);
  if (sp > V_THROW) { const k = V_THROW / sp; ux *= k; uy *= k; uz *= k; vx = rv.x + ux; vy = uy; vz = rv.z + uz; short = true; }
  return { vx, vy, vz, T, dist, short };
}
// the preview of a throw decided now by the chaser r (state s): points of the arc in sim space and where it crosses the target's z
export function previewArc(s, r, aim, n = 14) {
  const dir = s.dir, O0 = handAt(r.x, r.z, dir), t0 = WIND_TICKS * DT;
  const O = handAt(r.x + r.vlat * t0, r.z + dir * r.v * t0, dir);
  const P = { x: LANES[aim.lane], y: MARK_Y, z: aim.z };
  const sol = solveThrow(O, { x: r.vlat, z: dir * r.v }, P);
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = sol.T * i / n; pts.push({ x: O.x + sol.vx * t, y: O.y + sol.vy * t - 0.5 * GRAV * t * t, z: O.z + sol.vz * t }); }
  void O0;
  return { pts, T: sol.T, dist: sol.dist, short: sol.short, O, P };
}
