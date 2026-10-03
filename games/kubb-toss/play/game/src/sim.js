// The bridge between the rules (engine.js) and the physics (phys.js): build a world from a match, run a baton to rest, read the finals back.
import { newWorld, addBody, makeBody, standingQ, stepWorld, cloneWorld, batonFrom, launchOf, isDown, settled, kubbsAtRest, matOf, KUBB, KING, DT } from './phys.js';
import { KING_ID, throwLine, targets, dirOf } from './engine.js';

export function worldFromMatch(m, hide = -1) {
  const w = newWorld();
  for (const b of m.blocks) {
    if (b.role === 'cleared' || b.id === hide) continue;
    const h = b.kind === 'king' ? KING.h / 2 : KUBB.h / 2;
    const body = b.down && b.q
      ? makeBody(b.kind, [b.x, b.y, b.z], b.q, { id: b.id, team: b.team, asleep: true })
      : makeBody(b.kind, [b.x, b.y, h + 0.001], standingQ(b.yaw || 0), { id: b.id, team: b.team, asleep: true });
    addBody(w, body);
  }
  return w;
}
const yawOf = (b) => { const R = matOf(b.q); return Math.atan2(R[3], R[0]); };
export function finalsOf(world) {
  const out = [];
  for (const b of world.bodies) {
    if (b.kind === 'baton') continue;
    const down = isDown(b);
    out.push({ id: b.id, x: b.p[0], y: b.p[1], z: b.p[2], q: b.q.map((v) => Math.round(v * 10000) / 10000), down, yaw: down ? 0 : yawOf(b) });
  }
  return out;
}
// What the rules allow for the throw that is about to happen (captured before the baton leaves the hand).
export function maskOf(m) { const t = targets(m); return { base: t.kind !== 'field', king: t.king, kind: t.kind }; }

// Human error for one throw. err = { lat, spd, rev, th0, loft } (all zero = the plan exactly). `noise` scales it; `rnd` returns [0,1).
const gauss = (rnd) => { let u = 0; while (u < 1e-9) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const NOISE = { lat: 0.018, spd: 0.05 };
export const LOFT_K = [{ lat: 1.1, spd: 1.15 }, { lat: 1, spd: 1 }, { lat: 0.9, spd: 0.9 }];
export function errFor(loft, noise, rnd) {
  const k = LOFT_K[loft];
  return { lat: gauss(rnd) * NOISE.lat * k.lat * noise, spd: gauss(rnd) * NOISE.spd * k.spd * noise, rev: gauss(rnd) * 0.03 * noise, th0: gauss(rnd) * 0.08 * noise, loft: gauss(rnd) * 0.015 * noise };
}
// One-sigma size of the scatter on the ground for the aim overlay (metres across, metres along the throw) at a distance.
export function scatterAt(loft, dist, noise) {
  const k = LOFT_K[loft];
  return { across: NOISE.lat * k.lat * noise * dist, along: NOISE.spd * k.spd * noise * dist * 2 };
}

// A plan: { sx, ax, ay, loft, spin }; the line is the y the thrower stands on.
export function launchFor(plan, lineY, dir, err) { return launchOf(plan.sx, lineY, dir, plan.ax, plan.ay, plan.loft, plan.spin, err); }

export const MAX_STEPS = 240 * 7;
// Run a whole throw to rest in a copy of the world. Returns { world, finals, steps, hits } (events are summarised, not kept).
export function runThrow(world, L, id = 100, opt = {}) {
  const w = cloneWorld(world);
  addBody(w, batonFrom(L, id));
  let n = 0, first = null;
  while (n < MAX_STEPS) {
    stepWorld(w); n++;
    if (w.events.length) { if (!first) first = w.events[0]; w.events.length = 0; }
    if (n > 60 && n % 4 === 0 && (opt.early ? kubbsAtRest(w) : settled(w)) && !w.bodies.some((b) => b.kind === 'baton' && b.flight)) break;
  }
  return { world: w, finals: finalsOf(w), steps: n, first };
}
export { DT, KING_ID, throwLine, dirOf };
