// Shot solver: from a contact point and a landing spot on the floor, the launch velocity and spin that get there while clearing the net, corrected
// for drag and lift by running the real physics a few times. Used by the player's swing (aim drag) and by every AI decision.
import { BR, G, SHOTS, SURFACES, netTop, PHYS } from './consts.js';
import { newBall, stepBall } from './physics.js';

export function spinFor(kind, vx, vz, mult = 1) {
  const s = SHOTS[kind].spin * mult;
  const hl = Math.hypot(vx, vz) || 1, dx = vx / hl, dz = vz / hl;
  // topspin axis for horizontal travel d is up x d... the top of the ball moves forward: w = s * (dz, 0, -dx)
  return { wx: s * dz, wy: 0, wz: -s * dx };
}

export const shotSpeed = (kind, q = 1) => SHOTS[kind].v * (0.86 + 0.14 * q);

// Launch velocity for a ballistic flight from p0 to q over T seconds (no drag).
function ballistic(p0, q, T) {
  return { vx: (q.x - p0.x) / T, vy: (q.y - p0.y) / T + 0.5 * G * T, vz: (q.z - p0.z) / T };
}
function ballisticClear(p0, v) {       // clearance above the net tape without drag
  if (Math.abs(v.vz) < 1e-6) return -9;
  const tn = -p0.z / v.vz;
  if (tn <= 0) return -9;
  const y = p0.y + v.vy * tn - 0.5 * G * tn * tn, x = p0.x + v.vx * tn;
  return y - BR - netTop(x);
}

// Run the real physics from p0 and report where the ball first lands (after the net) and how high it passed the net.
export function trace(p0, v, w, surf = SURFACES.lawn, tMax = 2.6) {
  const b = newBall(p0.x, p0.y, p0.z, v.vx, v.vy, v.vz, w.wx, w.wy, w.wz);
  const h = 1 / 240, N = Math.ceil(tMax / h);
  let clr = null, pz = b.z;
  for (let k = 0; k < N; k++) {
    const py = b.y;
    const ev = stepBall(b, h, surf);
    if (clr === null && (pz < 0) !== (b.z < 0)) { const u = pz / (pz - b.z); clr = py + (b.y - py) * u - BR - netTop(b.x); }
    pz = b.z;
    if (ev.length) for (const e of ev) { if (e.kind === 'net') return { net: true, clr: clr ?? -1, t: (k + 1) * h }; if (e.kind === 'floor') return { x: e.x, z: e.z, t: (k + 1) * h, clr: clr ?? -1 }; }
  }
  return null;
}

/**
 * solveShot(p0, aim {x, z}, kind, q, surf, opts) -> { vx, vy, vz, wx, wy, wz, T, speed, land, clr }.
 * Corrects the aim iteratively so the real physics (drag, lift, spin) lands on the aim point, with the arc raised until the net is cleared.
 */
export function solveShot(p0, aim, kind, q = 1, surf = SURFACES.lawn, opts = {}) {
  const sh = SHOTS[kind];
  const speed = opts.speed ?? shotSpeed(kind, q);
  const clear = opts.clear ?? sh.clear;
  const goal = { x: aim.x, y: BR, z: aim.z };
  let tgt = { ...goal };
  const D0 = Math.hypot(goal.x - p0.x, goal.z - p0.z);
  let T = Math.max(0.28, D0 / (speed * 0.92));
  let sol = null;
  for (let it = 0; it < 14; it++) {
    const v = ballistic(p0, tgt, T);
    const w = spinFor(kind, v.vx, v.vz, opts.spinMult ?? 1);
    sol = { ...v, ...w, T, speed: Math.hypot(v.vx, v.vy, v.vz), land: null, clr: -1 };
    const r = trace(p0, v, w, surf);
    if (!r) break;
    sol.land = r.net ? null : { x: r.x, z: r.z }; sol.clr = r.clr;
    if (r.net || r.clr < clear - 0.04) { if (T >= 2.6) break; T *= 1.06; continue; }
    const ex = goal.x - r.x, ez = goal.z - r.z;
    if (Math.hypot(ex, ez) < 0.05) break;
    tgt = { x: tgt.x + ex * 0.95, y: BR, z: tgt.z + ez * 0.95 };
  }
  return sol;
}
export { PHYS };
