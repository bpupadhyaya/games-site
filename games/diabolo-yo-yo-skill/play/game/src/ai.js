// The playing hand: scripted-but-reactive hand controllers, a planner that searches their parameters by simulating the real
// physics, and a recorder for the ghost demo. The same controller drives Watch & Learn, Think and the ghost, so what the game
// shows is exactly what the physics will do. Pure and deterministic.
import { setHand, stepWorld, cloneWorld, YO, DB, HAND } from './phys.js';
import { newJudge, judgeStep, TRICK_BY_ID } from './tricks.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

// move the hand target toward (x, y) at no more than `v` metres per second
function slew(w, x, y, v, dt = 1 / 60) {
  const H = w.hand, dx = x - H.tx, dy = y - H.ty, d = Math.hypot(dx, dy), m = v * dt;
  if (d <= m) setHand(w, x, y); else setHand(w, H.tx + dx / d * m, H.ty + dy / d * m);
  return d <= m;
}

// ---- controllers ------------------------------------------------------------------------------
// kind: 'yo' (down | walk | fwd) and 'db' (spin | toss | pend)
export function newCtl(kind, p) { return { kind, p, ph: 0, t: 0, n: 0, floorT: 0, done: false, tossed: false }; }

function yoStep(w, c) {
  const p = c.p, y = w.yy, a = w.att;
  c.t += 1 / 60;
  const L = YO.L;
  switch (c.ph) {
    case 0: {                                           // flick: down, or out for a forward throw
      const fx = p.kind === 'fwd' ? Math.cos(p.ang) * p.D : 0, fy = p.kind === 'fwd' ? Math.sin(p.ang) * p.D : -p.D;
      if (slew(w, fx, fy, p.V) || y.mode !== 'home') { c.ph = 1; c.t = 0; }
      break;
    }
    case 1: {                                           // hold where the flick ended (low for the floor, brief otherwise)
      if (p.kind === 'walk') { if (y.mode === 'floor') c.floorT += 1 / 60; if (c.floorT > 0.2) { c.ph = 2; c.t = 0; } else if (c.t > 2) { c.ph = 4; } break; }
      if (c.t >= p.hold) { c.ph = 2; c.t = 0; }
      break;
    }
    case 2: {                                           // walk the dog / settle back to rest
      if (p.kind === 'walk') { slew(w, p.walkTo, w.hand.ty, p.walkV); if (a.walk >= p.minWalk || y.mode !== 'floor' || c.t > 4) c.ph = 4; }
      else if (slew(w, 0, 0, p.restV)) c.ph = 3;
      break;
    }
    case 3: {                                           // wait for the condition, then yank
      slew(w, p.kind === 'fwd' ? w.hand.tx * 0.98 : 0, 0, 0.5);
      const low = y.tight && y.y - w.hand.y < -0.55 * L;
      let ok = false;
      if (p.cond === 'sleep') ok = a.sleep >= p.min;
      else if (p.cond === 'loops') ok = a.loops >= p.min && low;
      else if (p.cond === 'reach') ok = a.reach >= 0.92 && low;
      else ok = c.t >= p.min;
      if (ok || y.mode === 'dead') { c.ph = 4; c.t = 0; }
      break;
    }
    case 4: {                                           // the yank
      if (slew(w, w.hand.tx, 0.5, 7) || y.mode === 'climb' || y.mode === 'home') { c.ph = 5; c.t = 0; }
      break;
    }
    default:
      slew(w, 0, 0, 1.2);
      if (y.mode === 'home' && c.t > 0.3) c.done = true;
  }
}

function predictLand(w) {                                // x where the airborne diabolo will come down to the string
  const d = w.db, H = w.hand, lev = H.y - 0.75;
  const disc = d.vy * d.vy + 2 * 9.8 * (d.y - lev);
  const t = disc > 0 ? (d.vy + Math.sqrt(disc)) / 9.8 : 0;
  return { x: d.x + d.vx * t, t };
}
function dbStep(w, c) {
  const p = c.p, d = w.db;
  c.t += 1 / 60;
  if (p.kind === 'pend') { setHand(w, p.A * Math.sin(TAU * p.f * c.t), 0); return; }
  const spinTo = c.ph === 0 || c.ph === 1;
  if (c.ph === 0) {                                      // spin up by shaking
    setHand(w, p.A * Math.sin(TAU * p.f * c.t), 0);
    if (p.kind === 'spin' ? false : d.w >= p.wT) { c.ph = 1; c.t = 0; }
  } else if (c.ph === 1) {                               // settle, then flick
    if (slew(w, p.fx0 ?? 0, 0, 1.4) && c.t > 0.15) { c.ph = 2; c.t = 0; }
  } else if (c.ph === 2) {                               // the toss
    if (slew(w, (p.fx0 ?? 0) + p.fx, p.F, p.V) || d.air) { c.ph = 3; c.t = 0; }
  } else if (c.ph === 3) {                               // follow it down, catch
    if (d.air) {
      const l = predictLand(w);
      slew(w, clamp(l.x + (p.lead ?? 0), -0.85, 0.85), Math.min(w.hand.ty, 0.0) * 0 + Math.max(0, w.hand.ty - 0.0), 3.2);
      if (w.hand.ty > 0.02) slew(w, w.hand.tx, 0, 1.0);
      c.tossed = true;
    } else if (c.tossed && d.mode === 'string') { c.n++; c.tossed = false; c.ph = c.n >= p.count ? 4 : 0; c.t = 0; }
    else if (c.t > 4 || d.mode === 'fall') { c.ph = 4; c.t = 0; }
    else slew(w, w.hand.tx, 0, 1.0);
  } else {
    slew(w, 0, 0, 1.2);
    if (c.t > 0.4) c.done = true;
  }
  void spinTo;
}
export function stepCtl(w, c) { if (c.kind === 'yo') yoStep(w, c); else dbStep(w, c); return c.done; }

// ---- rollouts ---------------------------------------------------------------------------------
// Runs the controller on a clone. Returns { ok, t, path } where ok means the target trick was judged.
export function rollout(w0, trickId, kind, p, o = {}) {
  const w = cloneWorld(w0), c = newCtl(kind, p), j = newJudge(), path = [], maxT = o.maxT ?? 16;
  j.last = w.eid;
  let ok = false, drops = 0, t = 0;
  for (let i = 0; i < maxT * 60; i++) {
    stepCtl(w, c);
    stepWorld(w);
    t += 1 / 60;
    const ev = judgeStep(j, w);
    for (const e of ev) { if (e.kind === 'trick' && e.id === trickId) ok = true; if (e.kind === 'drop') drops++; }
    if (o.record && i % 3 === 0) path.push(w.toy === 'yoyo' ? [w.yy.x, w.yy.y] : [w.db.x, w.db.y]);
    if (drops || (ok && c.done) || (c.done && i > 60 && !ok)) break;
  }
  return { ok: ok && !drops, t, path, drops };
}

// ---- parameter sampling per trick -------------------------------------------------------------
const R = (rng, a, b) => a + (b - a) * rng.next();
export function sample(trickId, rng, i) {
  switch (trickId) {
    case 'y-downup': return ['yo', { kind: 'down', D: R(rng, 0.16, 0.34), V: R(rng, 4, 9), hold: R(rng, 0.2, 0.4), restV: R(rng, 0.8, 1.4), cond: 'time', min: R(rng, 0.4, 1.4) }];
    case 'y-sleeper': return ['yo', { kind: 'down', D: R(rng, 0.16, 0.34), V: R(rng, 4, 9), hold: R(rng, 0.2, 0.4), restV: R(rng, 0.8, 1.4), cond: 'sleep', min: 2.7 }];
    case 'y-long': return ['yo', { kind: 'down', D: R(rng, 0.2, 0.36), V: R(rng, 6, 10), hold: R(rng, 0.2, 0.35), restV: R(rng, 0.8, 1.4), cond: 'sleep', min: 6.2 }];
    case 'y-walk': return ['yo', { kind: 'walk', D: R(rng, 0.4, 0.6), V: R(rng, 4, 8), hold: 0.3, restV: 1, walkTo: R(rng, 0.8, 1.0), walkV: R(rng, 0.5, 0.9), minWalk: R(rng, 1.0, 1.3), cond: 'none', min: 0 }];
    case 'y-break': return ['yo', { kind: 'fwd', ang: R(rng, -0.3, 0.2), D: R(rng, 0.28, 0.4), V: R(rng, 4, 7), hold: R(rng, 0.3, 0.6), restV: 0.5, cond: 'reach', min: 0.92 }];
    case 'y-around': return ['yo', { kind: 'fwd', ang: R(rng, -0.35, 0.45), D: R(rng, 0.45, 0.7), V: R(rng, 6, 10), hold: R(rng, 0.2, 0.6), restV: 0.4, cond: 'loops', min: 1 }];
    case 'y-double': return ['yo', { kind: 'fwd', ang: R(rng, 0.2, 0.7), D: R(rng, 0.55, 0.8), V: R(rng, 7, 11), hold: R(rng, 0.2, 0.6), restV: 0.4, cond: 'loops', min: 2 }];
    case 'd-spin': return ['db', { kind: 'spin', A: R(rng, 0.2, 0.42), f: R(rng, 1.2, 2.2), wT: 999, count: 0, F: 0, V: 1, fx: 0 }];
    case 'd-long': return ['db', { kind: 'spin', A: R(rng, 0.3, 0.5), f: R(rng, 1.4, 2.4), wT: 999, count: 0, F: 0, V: 1, fx: 0 }];
    case 'd-pend': return ['db', { kind: 'pend', A: R(rng, 0.2, 0.45), f: R(rng, 0.5, 0.9) }];
    case 'd-toss': return ['db', { kind: 'toss', A: R(rng, 0.2, 0.4), f: R(rng, 1.2, 2.2), wT: R(rng, 110, 170), F: R(rng, 0.2, 0.34), V: R(rng, 3, 8), fx: 0, fx0: 0, count: 1, lead: R(rng, -0.05, 0.08) }];
    case 'd-side': return ['db', { kind: 'toss', A: R(rng, 0.2, 0.4), f: R(rng, 1.2, 2.2), wT: R(rng, 120, 170), F: R(rng, 0.22, 0.34), V: R(rng, 4, 8), fx: R(rng, 0.45, 0.8) * (i % 2 ? 1 : -1), fx0: R(rng, -0.1, 0.1), count: 1, lead: R(rng, -0.05, 0.08) }];
    case 'd-high': return ['db', { kind: 'toss', A: R(rng, 0.3, 0.45), f: R(rng, 1.4, 2.2), wT: R(rng, 150, 220), F: R(rng, 0.33, 0.5), V: R(rng, 6, 12), fx: 0, fx0: 0, count: 1, lead: R(rng, -0.05, 0.08) }];
    case 'd-triple': return ['db', { kind: 'toss', A: R(rng, 0.25, 0.42), f: R(rng, 1.4, 2.3), wT: R(rng, 110, 160), F: R(rng, 0.2, 0.3), V: R(rng, 3, 7), fx: 0, fx0: 0, count: 3, lead: R(rng, -0.03, 0.06) }];
    default: return ['yo', { kind: 'down', D: 0.25, V: 6, hold: 0.3, restV: 1, cond: 'time', min: 1 }];
  }
}

// ---- the planner (time-sliced: step(n) runs n rollouts) ----------------------------------------
export function createPlanner(w0, trickId, rng, o = {}) {
  const want = o.want ?? 2, maxTries = o.maxTries ?? 60;
  const pl = { done: false, result: null, tries: 0, ok: 0, state: { arcs: [] } };
  const found = [];
  pl.step = (n = 1) => {
    for (let k = 0; k < n && !pl.done; k++) {
      const [kind, p] = sample(trickId, rng, pl.tries);
      const r = rollout(w0, trickId, kind, p, { record: true, maxT: o.maxT ?? 16 });
      pl.tries++;
      pl.state.arcs.push({ path: r.path, ok: r.ok });
      if (pl.state.arcs.length > 14) pl.state.arcs.shift();
      if (r.ok) { pl.ok++; found.push({ kind, p, t: r.t }); }
      if (pl.ok >= want || pl.tries >= maxTries) pl.finish();
    }
  };
  pl.finish = () => {
    pl.done = true;
    found.sort((a, b) => a.t - b.t);
    pl.result = found.length ? { kind: found[0].kind, params: found[0].p, t: found[0].t } : null;
  };
  return pl;
}

// ---- ghost recording --------------------------------------------------------------------------
// Frames for the ghost demo: the toy and the hand every tick for the planned solution.
export function recordGhost(w0, kind, p, maxT = 14) {
  const w = cloneWorld(w0), c = newCtl(kind, p), frames = [];
  for (let i = 0; i < maxT * 60; i++) {
    stepCtl(w, c); stepWorld(w);
    const t = w.toy === 'yoyo' ? w.yy : w.db;
    frames.push({ x: t.x, y: t.y, hx: w.hand.x, hy: w.hand.y, sp: w.hand.sp, w: t.w, ph: t.ph, tilt: w.toy === 'diabolo' ? w.db.tilt : 0, air: w.toy === 'diabolo' && w.db.air ? 1 : 0, mode: t.mode });
    if (c.done && i > 30) break;
  }
  return frames;
}
void DB; void HAND; void TRICK_BY_ID;
