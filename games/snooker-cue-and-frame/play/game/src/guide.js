// The aim guide. geometry: where the cue ball first touches something along the aim line. preview: the same shot played
// through the real physics for a short while (the paths of the white and of the first ball it hits). Pure functions.
import { R, TW, TL, CUE, ballById, cloneWorld, strike, stepWorld, STEP, POCKETS, pathClear } from './sim.js';
import { pocketAim } from './ai.js';

// First contact along the aim line (straight, no spin): ball hit, ghost-ball centre, cushion point if nothing is hit.
export function aimRay(w, angle) {
  const c = ballById(w, CUE);
  if (!c || !c.on) return null;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null;
  for (const q of w.b) {
    if (!q.on || q.id === CUE) continue;
    const bx = q.x - c.x, by = q.y - c.y;
    const proj = bx * dx + by * dy;
    if (proj <= 0) continue;
    const perp2 = bx * bx + by * by - proj * proj;
    const rr = 4 * R * R;
    if (perp2 >= rr) continue;
    const t = proj - Math.sqrt(rr - perp2);
    if (t > 0 && (!best || t < best.t)) best = { t, id: q.id };
  }
  // cushion
  let tw = Infinity;
  if (dx > 1e-9) tw = Math.min(tw, (TW - R - c.x) / dx); else if (dx < -1e-9) tw = Math.min(tw, (R - c.x) / dx);
  if (dy > 1e-9) tw = Math.min(tw, (TL - R - c.y) / dy); else if (dy < -1e-9) tw = Math.min(tw, (R - c.y) / dy);
  if (best && best.t <= tw) {
    const gx = c.x + dx * best.t, gy = c.y + dy * best.t, q = ballById(w, best.id);
    const nx = (q.x - gx) / (2 * R), ny = (q.y - gy) / (2 * R);
    // cut angle from the contact normal
    const cos = dx * nx + dy * ny;
    return { hit: best.id, ghost: { x: gx, y: gy }, obj: { x: q.x, y: q.y }, n: { x: nx, y: ny }, t: best.t, cut: Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI, end: { x: gx, y: gy } };
  }
  return { hit: null, ghost: null, t: tw, end: { x: c.x + dx * tw, y: c.y + dy * tw }, cut: 0 };
}

// Where would the object ball go along the contact normal? Stops at a cushion or at the first ball in its way. Returns the points and
// the pocket it would drop into, if any.
export function objectLine(w, ray) {
  if (!ray || ray.hit === null) return null;
  const { obj, n } = ray;
  let tmax = 3.4;
  const wall = (v, d, lo, hi) => (d > 1e-9 ? (hi - v) / d : d < -1e-9 ? (lo - v) / d : Infinity);
  tmax = Math.min(tmax, wall(obj.x, n.x, R, TW - R), wall(obj.y, n.y, R, TL - R));
  for (const q of w.b) {
    if (!q.on || q.id === ray.hit || q.id === CUE) continue;
    const bx = q.x - obj.x, by = q.y - obj.y, proj = bx * n.x + by * n.y;
    if (proj <= 0) continue;
    const perp2 = bx * bx + by * by - proj * proj;
    if (perp2 < 4 * R * R) { const t = proj - Math.sqrt(4 * R * R - perp2); if (t < tmax) tmax = Math.max(0, t); }
  }
  // does the line run into a pocket mouth?
  let pocket = -1;
  for (let i = 0; i < 6; i++) {
    const pa = pocketAim(i);
    const bx = pa.x - obj.x, by = pa.y - obj.y, proj = bx * n.x + by * n.y;
    if (proj <= 0) continue;
    const perp = Math.abs(bx * n.y - by * n.x);
    const lim = i < 4 ? 0.05 : 0.055;
    if (perp < lim && proj < tmax + 0.15) { pocket = i; tmax = Math.min(tmax, proj); break; }
  }
  return { from: { x: obj.x, y: obj.y }, to: { x: obj.x + n.x * tmax, y: obj.y + n.y * tmax }, pocket, len: tmax };
}

// The simulated preview: sample the white and the first ball it touches until `after` seconds past the first contact.
export function previewShot(w, shot, after = 1.1, maxT = 3.6) {
  const w2 = cloneWorld(w);
  strike(w2, shot);
  const cuePath = [[ballById(w2, CUE).x, ballById(w2, CUE).y]], objPath = [];
  let objId = -1, tHit = -1, n = 0, potted = null;
  const steps = Math.floor(maxT / STEP);
  for (let i = 0; i < steps; i++) {
    stepWorld(w2);
    if (w2.ev.length) {
      for (const e of w2.ev) {
        if (e.k === 'hit' && objId < 0 && (e.a === CUE || e.b === CUE)) { objId = e.a === CUE ? e.b : e.a; tHit = w2.t; const q = ballById(w2, objId); objPath.push([q.x, q.y]); }
        if (e.k === 'pot' && e.id !== CUE && potted === null) potted = { id: e.id, p: e.p };
        if (e.k === 'pot' && e.id === CUE) potted = potted ?? { id: CUE, p: e.p };
      }
      w2.ev.length = 0;
    }
    if (++n % 8 === 0) {
      const c = ballById(w2, CUE);
      if (c.on) cuePath.push([c.x, c.y]);
      if (objId >= 0) { const q = ballById(w2, objId); if (q.on) objPath.push([q.x, q.y]); }
    }
    if (tHit >= 0 && w2.t - tHit > after) break;
    let mv = false; for (const q of w2.b) if (q.on && (q.vx !== 0 || q.vy !== 0)) { mv = true; break; }
    if (!mv) break;
  }
  const c = ballById(w2, CUE);
  return { cuePath, objPath, objId, cueEnd: c.on ? { x: c.x, y: c.y } : null, potted, hit: objId >= 0 };
}
void POCKETS;

// Aim assist: when the aim line is within tolDeg of a clear potting line for the ball it first touches, return the exact angle.
export function snapAim(w, angle, tolDeg = 1.4) {
  const ray = aimRay(w, angle);
  if (!ray || ray.hit === null) return null;
  const c = ballById(w, CUE);
  const nAng = Math.atan2(ray.n.y, ray.n.x);
  let best = null, bd = tolDeg * Math.PI / 180;
  for (let p = 0; p < 6; p++) {
    const pa = pocketAim(p);
    const ux = pa.x - ray.obj.x, uy = pa.y - ray.obj.y, d = Math.hypot(ux, uy);
    if (d < 0.05) continue;
    let diff = Math.atan2(uy, ux) - nAng;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) >= bd) continue;
    if (!pathClear(w, ray.obj.x, ray.obj.y, pa.x, pa.y, [CUE, ray.hit])) continue;
    const gx = ray.obj.x - 2 * R * ux / d, gy = ray.obj.y - 2 * R * uy / d;
    if (!pathClear(w, c.x, c.y, gx, gy, [CUE, ray.hit])) continue;
    bd = Math.abs(diff); best = Math.atan2(gy - c.y, gx - c.x);
  }
  return best;
}
