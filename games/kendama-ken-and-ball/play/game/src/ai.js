// The hand that plays for Watch & Learn and the hint: a physics-search planner. A step (one catch) is performed by a
// small controller: get ready (flip if the base cup is needed), THROW (the hand yanks the ball up along an angle with a
// speed and a duration, then stops), then CATCH (follow the ball's predicted path, arrive with the ball's own
// velocity so it lands softly, then ease off). The planner tries many (angle, speed, duration) combinations on a
// cloned world with this same controller and keeps one that really lands the ball: the demonstration is the result of
// a real simulation, and the performance repeats it exactly.
import { cloneWorld, stepWorld, createWorld, CUPS, G, KEN_BOX, W, anchorOf, isFlipped, L } from './phys.js';

const TARGET_ID = { big: 1, small: 2, base: 3, spike: 4 };
export const TARGETS = ['big', 'small', 'spike', 'base'];
const SIT = {
  big: CUPS.big.sit, small: CUPS.small.sit, base: CUPS.base.sit, spike: { x: 0, y: -104 },
};
const READY = { x: 360, y: 700 };
const DAMP = 0.28;
const GIVE = 0.12;       // the hand gives way a little as the ball lands (fraction of the landing speed, in seconds)

// free flight with the air drag the physics uses: position and velocity after t seconds
function flight(b, t) {
  const e = Math.exp(-DAMP * t);
  const vtx = 0, vty = G / DAMP;
  const vx = vtx + (b.vx - vtx) * e, vy = vty + (b.vy - vty) * e;
  const f = (1 - e) / DAMP;
  return { x: b.x + vtx * t + (b.vx - vtx) * f, y: b.y + vty * t + (b.vy - vty) * f, vx, vy };
}

// The ken-local offset of the ball's resting position, seen from the ken's centre, for the orientation it is heading to.
function sitOffset(w, key) {
  const s = SIT[key];
  const up = Math.cos(w.ken.flipT) > 0;
  return up ? { x: s.x, y: s.y } : { x: -s.x, y: -s.y };
}

// The hand's target while popping: straight along (ang) at speed V for T seconds, then still. Shared by the human Pop
// button and the planner, so a plan found by the planner is exactly what pressing Pop does.
export function throwPos(p0, p, t) {
  const s = Math.min(t, p.T) * p.V;
  return { x: p0.x + Math.sin(p.ang) * s, y: p0.y - Math.cos(p.ang) * s };
}
export const POP_T = 0.12;
export const popSpeed = (charge) => 950 + 1350 * charge;
export const chargeOf = (V) => Math.max(0, Math.min(1, (V - 950) / 1350));

export function newCtl(w, step, params, o = {}) {
  return {
    step, p: params, phase: o.skipReady ? 'throw' : 'ready', t: 0, pt: 0, p0: o.skipReady ? { x: w.ken.x, y: w.ken.y } : null, fail: false, done: false,
    hx: w.ken.x, hy: w.ken.y, hvx: 0, hvy: 0,
  };
}

// A gentle hand: velocity-limited, acceleration-limited walk toward a spot, so a ball resting in a cup is not spilled.
function walk(c, gx, gy, vmax = 560, amax = 1400) {
  const dx = gx - c.hx, dy = gy - c.hy, d = Math.hypot(dx, dy);
  const want = Math.min(vmax, d * 5);
  const wx = d > 0.01 ? (dx / d) * want : 0, wy = d > 0.01 ? (dy / d) * want : 0;
  const ex = wx - c.hvx, ey = wy - c.hvy, em = Math.hypot(ex, ey), step = amax / 60;
  if (em > step) { c.hvx += (ex / em) * step; c.hvy += (ey / em) * step; } else { c.hvx = wx; c.hvy = wy; }
  c.hx += c.hvx / 60; c.hy += c.hvy / 60;
  if (d < 0.6) { c.hx = gx; c.hy = gy; c.hvx = 0; c.hvy = 0; }
}

// Advance the controller one tick: sets the hand target on the world. Returns 0 running, 1 caught, -1 failed.
export function stepCtl(w, c) {
  const k = w.ken, b = w.ball;
  const tid = TARGET_ID[c.step.t] ?? 0;
  c.t += 1 / 60;
  const wantFlip = c.step.t === 'base';
  if (c.phase === 'ready') {
    // set orientation, walk the hand to the ready spot, wait until the ball is calm
    w.ken.flipT = wantFlip ? Math.PI : 0;
    walk(c, READY.x, READY.y);
    k.tx = c.hx; k.ty = c.hy;
    const there = Math.abs(k.x - READY.x) < 3 && Math.abs(k.y - READY.y) < 3;
    const flipped = Math.abs(k.flip - k.flipT) < 0.03 && Math.abs(k.fv) < 0.3;
    const calm = (b.mode === 1 && b.sp >= 1) || b.on > 0 ? b.onT > 0.3 : b.still > 0.35;
    if (there && flipped && calm && Math.abs(k.vx) < 20 && Math.abs(k.vy) < 20) { c.phase = 'throw'; c.pt = 0; c.p0 = { x: k.x, y: k.y }; }
    if (c.t > 14) return -1;
    return 0;
  }
  if (c.phase === 'throw') {
    c.pt += 1 / 60;
    const q = throwPos(c.p0, c.p, c.pt);
    c.hx = q.x; c.hy = q.y;
    k.tx = c.hx; k.ty = c.hy;
    if (c.pt >= c.p.T + 0.07) { c.phase = 'catch'; c.ct = 0; c.landed = 0; }
    return 0;
  }
  // catch
  c.ct += 1 / 60;
  if (b.on === tid && b.onT >= 0.55) return 1;
  if (b.on > 0 && b.on !== tid) { c.wrongT = (c.wrongT ?? 0) + 1 / 60; if (c.wrongT > 1.2) return -1; }
  if ((b.still > 1.0 || b.rest > 1.0) && c.ct > 0.5) return -1;
  if (c.ct > 7) return -1;
  if (b.on === tid || b.on > 0) { k.tx = k.x; k.ty = k.y; c.landed += 1 / 60; return 0; }

  const off = sitOffset(w, c.step.t);
  // find the landing: the first moment the ball centre reaches the contact level while falling.
  // Re-solved every few ticks (every tick near the landing): the scan is the expensive part of the planner.
  let best = c.best;
  if (!best || c.ct - c.bestAt >= 0.065 || best.tAbs - c.ct < 0.18) {
    best = null;
    for (let Yc = 640; Yc >= 440; Yc -= 20) {
      const level = Yc + off.y;
      let found = null;
      let prev = flight(b, 0);
      for (let t = 0.02; t < 2.6; t += 0.02) {
        const q = flight(b, t);
        if (q.vy > 0 && prev.y < level && q.y >= level) { const f = (level - prev.y) / (q.y - prev.y); found = { t: t - 0.02 + 0.02 * f, x: prev.x + (q.x - prev.x) * f, vx: q.vx, vy: q.vy }; break; }
        prev = q;
      }
      if (!found) continue;
      if (Yc + found.vy * GIVE <= KEN_BOX.y1 - 4) { best = { Yc, ...found }; break; }
      if (!best) best = { Yc, ...found };
    }
    if (best) { best.tAbs = c.ct + best.t; c.best = best; c.bestAt = c.ct; }
  }
  if (!best) { k.tx = Math.max(KEN_BOX.x0, Math.min(KEN_BOX.x1, b.x - off.x)); k.ty = k.y; return 0; }
  best = { ...best, t: Math.max(0, best.tAbs - c.ct) };
  const xs = Math.max(KEN_BOX.x0, Math.min(KEN_BOX.x1, best.x - off.x));
  if (c.giveAt === undefined && best.t <= 0.05) { c.giveAt = c.ct; c.giveV = best.vy; c.giveY = best.Yc; }
  k.tx = xs + (c.errx || 0);
  if (c.giveAt !== undefined) k.ty = c.giveY + GIVE * c.giveV * (1 - Math.exp(-8 * (c.ct - c.giveAt)));
  else k.ty = best.Yc;
  return 0;
}

// ---- planner -----------------------------------------------------------------------------------
// Runs the controller on a clone until it ends. Returns { ok, ticks, w } (w = the final world, for the caller).
export function simulate(w0, step, params, maxTicks = 900, onTick = null, o = {}) {
  const w = cloneWorld(w0);
  const c = newCtl(w, step, params, o);
  for (let i = 0; i < maxTicks; i++) {
    const r = stepCtl(w, c);
    stepWorld(w);
    if (onTick) onTick(w, c, i);
    if (r !== 0) return { ok: r > 0, ticks: i, w, c };
  }
  return { ok: false, ticks: maxTicks, w, c };
}

// Candidate parameters come from a small deterministic sequence (no randomness source needed in the planner).
export function sampleParams(rng, o = {}) {
  if (o.straight) return { ang: 0, V: 1000 + rng.next() * 1300, T: POP_T };
  return { ang: (rng.next() - 0.5) * 2 * 0.62, V: 1000 + rng.next() * 1300, T: 0.08 + rng.next() * 0.1 };
}

export function createPlanner(w0, step, rng, opts = {}) {
  const want = opts.want ?? 3;               // successes to collect before choosing
  const maxTries = opts.maxTries ?? 400;
  const state = { done: false, tries: 0, found: [], best: null, arcs: [] };
  const planner = {
    state,
    get done() { return state.done; },
    // spend `n` simulations
    step(n = 6) {
      for (let i = 0; i < n && !state.done; i++) {
        const params = sampleParams(rng, opts);
        state.tries++;
        const arc = [];
        let land = null;
        const r = simulate(w0, step, params, 900, (w, c, tick) => {
          if (tick % 6 === 0 && c.phase !== 'ready') arc.push(Math.round(w.ball.x), Math.round(w.ball.y));
          if (w.ball.on > 0 && !land) land = { x: Math.round(w.ken.x), y: Math.round(w.ken.y), flip: Math.cos(w.ken.flip) < 0 };
        }, { skipReady: opts.skipReady });
        if (state.arcs.length < 14 || r.ok) { state.arcs.push({ pts: arc, ok: r.ok }); if (state.arcs.length > 14) { const j = state.arcs.findIndex((a) => !a.ok); if (j >= 0) state.arcs.splice(j, 1); else state.arcs.shift(); } }
        if (r.ok) {
          // quality: gentle landings and short time
          const score = r.ticks / 60 + Math.abs(params.ang) * 1.2 + params.V / 3000;
          state.found.push({ params, ticks: r.ticks, score, arc, land });
        }
        if (state.found.length >= want || state.tries >= maxTries) planner.finish();
      }
    },
    // stop searching and settle on the best plan found so far
    finish() {
      state.done = true;
      state.best = state.found.length ? state.found.reduce((a, b) => (b.score < a.score ? b : a)) : null;
    },
    get result() { return state.best; },
  };
  return planner;
}

export { createWorld };
