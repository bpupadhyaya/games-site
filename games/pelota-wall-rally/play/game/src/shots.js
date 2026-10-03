// Shot solver: from a contact point and an aim point on a wall, the launch velocity and spin that get there, corrected for drag and lift by
// running the real physics a few times. Used by the player's swing (aim tap) and by every AI decision.
import { HW, L, BR, G, SHOTS, EQUIP } from './consts.js';
import { newBall, stepBall } from './physics.js';

// Aim points live on the front wall (plane z = L) or the left wall (plane x = HW). { wall: 'front', x, y } | { wall: 'left', z, y }
export const frontAim = (x, y) => ({ wall: 'front', x, y });
export const leftAim = (z, y) => ({ wall: 'left', z, y });
const aimPoint = (a) => (a.wall === 'left' ? { x: HW - BR, y: a.y, z: a.z } : { x: a.x, y: a.y, z: L - BR });

export function spinFor(kind, vx, vz, mult = 1) {
  const s = SHOTS[kind].spin * mult;
  const hl = Math.hypot(vx, vz) || 1, dx = vx / hl, dz = vz / hl;
  // topspin axis for horizontal travel d is up x d = (dz, 0, -dx)... (y=1: (1*dz - 0, 0, 0 - 1*dx))
  return { wx: s * dz, wy: 0, wz: -s * dx };
}

/** Speed of a shot (m/s) for a kind and equipment, scaled by quality (0..1). */
export const shotSpeed = (kind, equip, q = 1) => SHOTS[kind].v * EQUIP[equip].boost * (0.82 + 0.18 * q);

// Launch velocity for a ballistic flight from p0 to q over T seconds (no drag).
function ballistic(p0, q, T) {
  return { vx: (q.x - p0.x) / T, vy: (q.y - p0.y) / T + 0.5 * G * T, vz: (q.z - p0.z) / T };
}

// Run the real physics from p0 with velocity v and find where the ball first reaches the aim wall. Returns { x, y, z, t, hitOther } or null.
function reach(p0, v, w, wall, tMax = 2.2) {
  const b = newBall(p0.x, p0.y, p0.z, v.vx, v.vy, v.vz, w.wx, w.wy, w.wz);
  const h = 1 / 240, N = Math.ceil(tMax / h);
  let t = 0;
  for (let k = 0; k < N; k++) {
    t += h;
    const ev = stepBall(b, h);
    if (wall === 'front' && b.z >= L - BR - 1e-9) return { x: b.x, y: b.y, z: b.z, t };
    if (wall === 'left' && b.x >= HW - BR - 1e-9) return { x: b.x, y: b.y, z: b.z, t };
    if (ev.length && ev.some((e) => e.kind === 'floor')) return { x: b.x, y: b.y, z: b.z, t, floor: true };
  }
  return null;
}

/**
 * solveShot(p0, aim, kind, equip, q, opts) -> { vx, vy, vz, wx, wy, wz, T, speed }.
 * Corrects the aim iteratively so the real physics (drag, lift) lands on the aim point.
 */
export function solveShot(p0, aim, kind, equip = 'hand', q = 1, opts = {}) {
  const speed = (opts.speed ?? shotSpeed(kind, equip, q));
  let tgt = aimPoint(aim);
  const goal = aimPoint(aim);
  let sol = null;
  for (let it = 0; it < 4; it++) {
    const D = Math.hypot(tgt.x - p0.x, tgt.y - p0.y, tgt.z - p0.z);
    let T = Math.max(0.12, D / speed);
    let v = ballistic(p0, tgt, T);
    // a lob is steeper: add flight time for the arc
    if (kind === 'lob') { const hmax = Math.max(0, goal.y - p0.y); T = Math.max(T, 0.55 + 0.5 * Math.sqrt(hmax)); v = ballistic(p0, tgt, T); }
    const w = spinFor(kind, v.vx, v.vz, opts.spinMult ?? 1);
    sol = { ...v, ...w, T, speed: Math.hypot(v.vx, v.vy, v.vz) };
    const r = reach(p0, v, w, aim.wall);
    if (!r || r.floor) break;
    const ex = goal.x - r.x, ey = goal.y - r.y, ez = goal.z - r.z;
    if (Math.hypot(ex, ey, ez) < 0.03) break;
    tgt = { x: tgt.x + ex, y: tgt.y + ey, z: tgt.z + ez };
  }
  return sol;
}
