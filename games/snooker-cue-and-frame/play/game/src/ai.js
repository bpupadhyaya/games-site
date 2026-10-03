// The computer players. Five levels share ONE planner (so a hint is the Master's own choice and every opponent is "the same
// player with a worse arm"): it builds candidate shots from the geometry (ghost-ball pots with throw compensation, then
// safety shots), PLAYS each one through the real physics and rules, and keeps the best by points now plus how easy the
// next shot is. Levels differ in how much they search and in the execution error added when the shot is played.
import {
  R, TW, TL, CUE, POCKETS, GEOM, STEP, V_MAX, BAULK_Y, D_R, MID_X, ballById, cloneWorld, strike, stepWorld, settle, pathClear, spotFree, inD, powerToSpeed,
  isRed, VALUE, nameOf, CUE as CUEID,
} from './sim.js';
import { judge, applyShot, ballsOn, beforeShot, isSnookered, canSeeBallOn, other, placeCue } from './rules.js';

export const PROFILES = [
  { id: 0, name: 'Beginner', stars: 1, tag: 'Still learning the angles', sigA: 0.55, sigP: 0.16, sigS: 0.25, cands: 4, polish: 0, safety: 0.15, pos: 0.0, robust: 0, blunder: 0.3, think: [0.8, 1.6] },
  { id: 1, name: 'Casual', stars: 2, tag: 'Pots the easy ones', sigA: 0.26, sigP: 0.10, sigS: 0.15, cands: 8, polish: 0, safety: 0.5, pos: 0.3, robust: 2, blunder: 0.12, think: [1.0, 2.0] },
  { id: 2, name: 'Club', stars: 3, tag: 'Builds small breaks', sigA: 0.13, sigP: 0.06, sigS: 0.09, cands: 16, polish: 1, safety: 0.85, pos: 0.7, robust: 3, blunder: 0.04, think: [1.2, 2.4] },
  { id: 3, name: 'Expert', stars: 4, tag: 'Position and safety', sigA: 0.065, sigP: 0.035, sigS: 0.05, cands: 28, polish: 2, safety: 1, pos: 1.0, robust: 4, blunder: 0.0, think: [1.5, 3.0] },
  { id: 4, name: 'Master', stars: 5, tag: 'Long breaks, tight safety', sigA: 0.03, sigP: 0.018, sigS: 0.025, cands: 44, polish: 3, safety: 1, pos: 1.15, robust: 5, blunder: 0.0, think: [1.8, 3.4] },
];

export const rad = (d) => d * Math.PI / 180;
export function gauss(rng) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// the centre of each pocket mouth: where an object ball is aimed
const JAW_MID = (() => {
  const { CE, RK } = GEOM;
  const c = (CE + RK) / 2;
  return [
    { x: c, y: c }, { x: TW - c, y: c }, { x: c, y: TL - c }, { x: TW - c, y: TL - c },
    { x: RK + 0.012, y: TL / 2 }, { x: TW - RK - 0.012, y: TL / 2 },
  ];
})();
export const pocketAim = (i) => JAW_MID[i];

// ---- playing a shot through the real rules ---------------------------------------------------------------------------------
function cloneFrame(f) {
  return { ...f, scores: f.scores.slice(), breaks: f.breaks.slice(), high: f.high.slice(), fouls: f.fouls.slice(), cfg: f.cfg };
}
export function playOut(f, w, shot, maxT = 24) {
  const w2 = cloneWorld(w);
  const f2 = cloneFrame(f);
  const before = beforeShot(f, w);
  strike(w2, shot);
  const ev = [];
  let n = Math.floor(maxT / STEP);
  while (n-- > 0) {
    stepWorld(w2);
    if (w2.ev.length) { for (const e of w2.ev) ev.push(e); w2.ev.length = 0; }
    let mv = false;
    for (const q of w2.b) if (q.on && (q.vx !== 0 || q.vy !== 0 || q.wx !== 0 || q.wy !== 0)) { mv = true; break; }
    if (!mv) break;
  }
  for (const q of w2.b) { q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; q.wz = 0; }
  const res = judge(f2, w2, ev, before);
  const out = applyShot(f2, w2, res, before);
  return { f: f2, w: w2, ev, res, out, before };
}

// ---- how comfortable is the next shot? (geometry only) -----------------------------------------------------------------------
// Returns 0..1 for the best pot available to the player about to shoot, plus a note about the best pair.
export function easeFor(f, w) {
  const c = ballById(w, CUE);
  if (f.inHand || !c || !c.on) return { ease: 0.8, best: null };
  const targets = f.free ? w.b.filter((q) => q.on && q.id !== CUE).map((q) => q.id) : ballsOn(f, w);
  if (!targets.length) return { ease: 0, best: null };
  if (!f.free && isSnookered(f, w)) return { ease: 0.04, best: null, snookered: true };
  let best = 0, bestInfo = null;
  for (const id of targets) {
    const t = ballById(w, id);
    for (let p = 0; p < 6; p++) {
      const g = potGeometry(w, c, t, p);
      if (!g) continue;
      const q = g.quality;
      if (q > best) { best = q; bestInfo = { id, p }; }
    }
  }
  return { ease: best, best: bestInfo };
}

// Ghost-ball geometry for cue ball c, target t, pocket p. null when the pot is geometrically impossible/blocked.
export function potGeometry(w, c, t, p) {
  const pa = JAW_MID[p];
  let ux = pa.x - t.x, uy = pa.y - t.y;
  const dT = Math.hypot(ux, uy);
  if (dT < 0.05) return null;
  ux /= dT; uy /= dT;
  const gx = t.x - 2 * R * ux, gy = t.y - 2 * R * uy;
  if (gx < R || gx > TW - R || gy < R || gy > TL - R) return null;
  const cx = gx - c.x, cy = gy - c.y, dC = Math.hypot(cx, cy);
  if (dC < 0.002) return null;
  const cosCut = (cx * ux + cy * uy) / dC;
  if (cosCut < 0.2) return null;                           // too thin to be reliable
  // a middle pocket cannot take a ball that arrives at a steep angle
  if (p >= 4) { const side = p === 4 ? 1 : -1; if (ux * side < 0.45) return null; }
  if (!pathClear(w, c.x, c.y, gx, gy, [CUE, t.id])) return null;
  if (!pathClear(w, t.x, t.y, pa.x, pa.y, [CUE, t.id])) return null;
  const dist = dC + dT;
  const quality = Math.max(0.01, (0.35 + 0.65 * cosCut * cosCut) / (1 + 0.55 * dist) * (dC > 0.0 ? 1 : 1));
  return { gx, gy, ux, uy, dC, dT, cosCut, quality, pa };
}

// ---- candidate construction -----------------------------------------------------------------------------------------------------
const POWER_INV = (v) => Math.pow(Math.max(0, (v - 0.18) / (V_MAX - 0.18)), 1 / 1.7);
function targetsFor(f, w) {
  return f.free ? w.b.filter((q) => q.on && q.id !== CUE).map((q) => q.id) : ballsOn(f, w);
}

// contact velocity of the object ball for a shot (used to compensate throw): play until the cue ball's first impact.
function firstContact(w, shot) {
  const w2 = cloneWorld(w);
  strike(w2, shot);
  let n = Math.floor(4 / STEP);
  while (n-- > 0) {
    stepWorld(w2);
    const e = w2.ev.find((x) => x.k === 'hit' && (x.a === CUE || x.b === CUE));
    if (e) { const id = e.a === CUE ? e.b : e.a; const q = ballById(w2, id); return { id, vx: q.vx, vy: q.vy }; }
    w2.ev.length = 0;
  }
  return null;
}

export function potCandidates(f, w, lim = 99) {
  const c = ballById(w, CUE);
  const out = [];
  for (const id of targetsFor(f, w)) {
    const t = ballById(w, id);
    for (let p = 0; p < 6; p++) {
      const g = potGeometry(w, c, t, p);
      if (!g) continue;
      out.push({ kind: 'pot', target: id, pocket: p, g, pri: g.quality });
    }
  }
  out.sort((a, b) => b.pri - a.pri || a.target - b.target || a.pocket - b.pocket);
  // keep a spread: at most 3 pockets per ball
  const per = new Map(), kept = [];
  for (const o of out) { const n = per.get(o.target) ?? 0; if (n >= 3) continue; per.set(o.target, n + 1); kept.push(o); if (kept.length >= lim) break; }
  return kept;
}

// the aim angle for a pot, compensating throw by measuring the object ball's real departure direction
export function aimAngle(w, cand, power, spin, iters = 2) {
  const c = ballById(w, CUE), t = ballById(w, cand.target);
  const { ux, uy, pa } = cand.g;
  let want = Math.atan2(uy, ux);
  let angle = Math.atan2(cand.g.gy - c.y, cand.g.gx - c.x);
  for (let i = 0; i < iters; i++) {
    const fc = firstContact(w, { angle, power, a: spin.a, b: spin.b });
    if (!fc || fc.id !== cand.target) break;
    let err = Math.atan2(fc.vy, fc.vx) - want;
    while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    if (Math.abs(err) < 0.0004) break;
    // re-aim the contact normal opposite to the error
    const a2 = want - err;
    const gx = t.x - 2 * R * Math.cos(a2), gy = t.y - 2 * R * Math.sin(a2);
    angle = Math.atan2(gy - c.y, gx - c.x);
  }
  void pa;
  return angle;
}

const SPINS = [
  { a: 0, b: 0, tag: 'stun' }, { a: 0, b: 0.55, tag: 'follow' }, { a: 0, b: -0.55, tag: 'draw' },
  { a: 0.45, b: 0, tag: 'right' }, { a: -0.45, b: 0, tag: 'left' }, { a: 0, b: 0.9, tag: 'follow hard' }, { a: 0, b: -0.9, tag: 'draw hard' },
];

function powerFor(cand, mult) {
  const g = cand.g;
  const vObj = Math.sqrt(0.5 * g.dT * 0.45 + 0.09);      // enough to roll to the pocket and drop
  const vc = vObj / Math.max(0.35, g.cosCut) * mult;
  const v0 = Math.sqrt(vc * vc + 2 * 0.3 * g.dC);
  return Math.max(0.05, Math.min(1, POWER_INV(v0)));
}

// ---- values -------------------------------------------------------------------------------------------------------------------
function valueOf(f0, r, prof, ctx) {
  const me = f0.turn;
  const f = r.f;
  let v = 0;
  if (r.res.foul) {
    v = -r.res.foulPts * 1.0;
    const e = easeFor(f, r.w);
    v -= e.ease * 3.5 * (prof.pos ? 1 : 0.6);
    if (r.res.cuePot) v -= 0.5;
  } else {
    v = r.res.scored;
    if (f.over && f.over.win === me) v += 40;
    else if (f.over) v -= 40;
    else if (f.turn === me) {
      const e = easeFor(f, r.w);
      v += e.ease * 3.6 * prof.pos + (e.snookered ? -2 : 0);
    } else {
      const e = easeFor(f, r.w);
      v -= e.ease * 3.8 * (0.5 + 0.5 * prof.pos);
      if (e.snookered) v += 2.5 * prof.pos;
      // a safe shot is better when the cue ball is left behind the blue/baulk (far from the pack)
      const c = ballById(r.w, CUE);
      if (c && c.on) v += (0.25 * (1 - Math.min(1, Math.abs(c.y - 0.4) / 3.2))) * prof.pos;
    }
  }
  void ctx;
  return v;
}

// ---- the planner ----------------------------------------------------------------------------------------------------------------
// createPlanner(f, w, prof, rng, { perfect }) -> { step(n), done, result }. The nominal shot is chosen with no noise; noise is applied
// by the caller when the shot is actually played (execNoise).
export function createPlanner(f, w, prof, rng, o = {}) {
  const me = f.turn;
  const P = o.perfect ? PROFILES[4] : prof;
  const queue = [];
  const results = [];
  let stage = 0, done = false, result = null, polishList = null;
  const baseCands = potCandidates(f, w, P.cands);
  const plans = [];
  // stage 0: build pot plans with spins and powers
  for (const cand of baseCands) {
    const spinsN = P.pos > 0.9 ? SPINS.length : P.pos > 0.5 ? 5 : P.pos > 0 ? 3 : 1;
    const mults = P.pos > 0.9 ? [1, 1.6, 2.5] : P.pos > 0.5 ? [1, 1.8] : [1.3];
    for (let si = 0; si < spinsN; si++) for (const m of mults) plans.push({ cand, spin: SPINS[si], mult: m });
  }
  // limit the work per level
  const maxPlans = o.perfect ? 90 : Math.round(8 + P.cands * 2.2);
  // order: best geometric first, stun first
  plans.sort((a, b) => b.cand.pri - a.cand.pri);
  const planList = plans.slice(0, maxPlans);
  let pi = 0;

  const safetyList = () => {
    const out = [];
    const c = ballById(w, CUE);
    const tg = targetsFor(f, w).map((id) => ballById(w, id)).filter(Boolean);
    tg.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    // one ball per cluster is enough: skip balls touching one already chosen
    const near = [];
    for (const t of tg) { if (near.every((n) => Math.hypot(n.x - t.x, n.y - t.y) > 4 * R)) near.push(t); if (near.length >= (P.pos > 0.9 ? 4 : 2)) break; }
    for (const t of near) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      const base = Math.atan2(t.y - c.y, t.x - c.x);
      const half = Math.asin(Math.min(0.999, 2 * R / Math.max(2 * R + 0.01, d)));
      for (const off of [-0.9, -0.6, -0.3, -0.12, 0, 0.12, 0.3, 0.6, 0.9]) {
        for (const pw of [0.2, 0.3, 0.42, 0.58, 0.75]) for (const sp of [SPINS[0], SPINS[2], SPINS[1]]) out.push({ kind: 'safety', target: t.id, angle: base + off * half, power: pw, a: sp.a, b: sp.b });
      }
    }
    return out;
  };
  const evaluate = (plan) => {
    let shot;
    if (plan.kind === 'safety') shot = { angle: plan.angle, power: plan.power, a: plan.a, b: plan.b };
    else {
      const power = powerFor(plan.cand, plan.mult);
      const angle = aimAngle(w, plan.cand, power, plan.spin, P.polish > 0 ? 2 : 1);
      shot = { angle, power, a: plan.spin.a, b: plan.spin.b };
    }
    const r = playOut(f, w, shot);
    const potsTarget = plan.kind !== 'safety' && r.res.potted.includes(plan.cand.target);
    let val = valueOf(f, r, P, null);
    if (plan.kind !== 'safety' && !potsTarget) val -= 1.5;              // the pot was the point
    return { plan, shot, r, val, pots: potsTarget, kind: plan.kind === 'safety' ? 'safety' : potsTarget ? 'pot' : 'miss' };
  };

  const finish = () => {
    done = true;
    results.sort((a, b) => b.val - a.val);
    // expected value under this level's own execution error: the top few are replayed with noise and re-ranked
    const nR = o.perfect ? 4 : P.robust;
    if (nR > 0 && results.length > 1) {
      const top = results.slice(0, Math.min(results.length, nR));
      const prof2 = o.perfect ? { sigA: 0.03, sigP: 0.018, sigS: 0.025 } : P;
      for (const x of top) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const r = playOut(f, w, execNoise(x.shot, prof2, rng));
          const pt = x.plan.kind !== 'safety' && r.res.potted.includes(x.plan.cand.target);
          sum += valueOf(f, r, P, null) + (x.plan.kind !== 'safety' && !pt ? -1.5 : 0);
        }
        x.val = 0.35 * x.val + 0.65 * (sum / 4);
      }
      results.sort((a, b) => b.val - a.val);
    }
    let best = results[0] ?? null;
    if (!o.perfect && best && P.blunder > 0 && rng.next() < P.blunder && results.length > 2) best = results[1 + rng.int(Math.min(3, results.length - 1))];
    result = best ? build(best) : fallbackShot();
  };
  const build = (b) => ({
    shot: b.shot, kind: b.kind, value: b.val, target: b.plan.kind === 'safety' ? b.plan.target : b.plan.cand.target, pocket: b.plan.kind === 'safety' ? -1 : b.plan.cand.pocket,
    spin: b.plan.kind === 'safety' ? null : b.plan.spin.tag, sim: b.r, alts: results.filter((x) => x !== b).slice(0, 2).map((x) => ({ kind: x.kind, target: x.plan.kind === 'safety' ? x.plan.target : x.plan.cand.target, val: x.val })),
    ease: easeFor(b.r.f, b.r.w).ease,
  });
  const fallbackShot = () => {
    const c = ballById(w, CUE), tg = targetsFor(f, w).map((id) => ballById(w, id)).filter(Boolean);
    tg.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    const t = tg[0] ?? ballById(w, 1) ?? { x: c.x, y: c.y + 1, id: 1 };
    const shot = { angle: Math.atan2(t.y - c.y, t.x - c.x), power: 0.3, a: 0, b: 0 };
    const r = playOut(f, w, shot);
    return { shot, kind: 'safety', value: valueOf(f, r, P, null), target: t.id, pocket: -1, spin: null, sim: r, alts: [], ease: 0 };
  };

  const stepOne = () => {
    if (stage === 0) {
      if (pi < planList.length) { results.push(evaluate(planList[pi++])); return; }
      // decide whether to also look at safety
      const bestPot = results.reduce((m, x) => Math.max(m, x.val), -99);
      const potted = results.some((x) => x.pots && x.val > 0);
      stage = 1;
      const wantSafety = !potted || bestPot < 2.2 || rng.next() < 0.1;
      if (wantSafety && (P.safety > 0) && (o.perfect || rng.next() < P.safety || !potted)) { safeQ = safetyList(); if (!o.perfect && safeQ.length > P.cands * 3) safeQ = safeQ.filter((_, i) => i % Math.ceil(safeQ.length / (P.cands * 3)) === 0); }
      else safeQ = [];
      si2 = 0;
      return;
    }
    if (stage === 1) {
      if (si2 < safeQ.length) { results.push(evaluate(safeQ[si2++])); return; }
      stage = 2; return;
    }
    if (stage === 2) {
      // polish the best few pots by trying tiny aim changes (levels >= Club)
      if (polishList === null) {
        const pots = results.filter((x) => x.pots).sort((a, b) => b.val - a.val).slice(0, P.polish);
        polishList = [];
        for (const pt of pots) for (const d of [-0.35, 0.35]) polishList.push({ pt, d });
        pj = 0;
      }
      if (pj < polishList.length) {
        const { pt, d } = polishList[pj++];
        const shot = { ...pt.shot, angle: pt.shot.angle + rad(d) };
        const r = playOut(f, w, shot);
        const potsTarget = r.res.potted.includes(pt.plan.cand.target);
        const val = valueOf(f, r, P, null) + (potsTarget ? 0 : -1.5);
        // robustness: prefer a shot that still pots when nudged; this one is only kept if it beats the original
        if (potsTarget && val > pt.val + 0.01) results.push({ plan: pt.plan, shot, r, val, pots: true, kind: 'pot' });
        return;
      }
      finish();
    }
  };
  let safeQ = [], si2 = 0, pj = 0;
  return {
    get done() { return done; },
    get result() { return result; },
    get progress() { return stage === 0 ? pi / Math.max(1, planList.length) : 1; },
    step(n = 1) { while (n-- > 0 && !done) stepOne(); },
    runAll() { while (!done) stepOne(); return result; },
  };
}

// Apply the player's execution error to a nominal shot.
export function execNoise(shot, prof, rng, human = false) {
  const sa = human ? 0.35 : prof.sigA, sp = human ? 0.05 : prof.sigP, ss = human ? 0.04 : prof.sigS;
  const power = Math.max(0.03, Math.min(1, shot.power * (1 + gauss(rng) * sp)));
  return {
    angle: shot.angle + rad(gauss(rng) * sa),
    power,
    a: Math.max(-1, Math.min(1, shot.a + gauss(rng) * ss)),
    b: Math.max(-1, Math.min(1, shot.b + gauss(rng) * ss)),
  };
}

// ---- cue ball in hand: choose a spot in the D -----------------------------------------------------------------------------------
export function bestPlacement(f, w, prof, rng) {
  const spots = [];
  for (let ix = -4; ix <= 4; ix++) for (let iy = 0; iy <= 3; iy++) {
    const x = MID_X + ix * 0.065, y = BAULK_Y - 0.03 - iy * 0.085;
    if (inD(x, y) && spotFree(w, x, y, CUE)) spots.push({ x, y });
  }
  if (!spots.length) return { x: MID_X, y: BAULK_Y - 0.12 };
  let best = spots[0], bv = -1;
  for (const s of spots) {
    const w2 = cloneWorld(w);
    const c = ballById(w2, CUE); c.x = s.x; c.y = s.y; c.on = true;
    const f2 = { ...f, inHand: false };
    const e = easeFor(f2, w2).ease + (canSeeBallOn(f2, w2) ? 0.15 : -0.1) + (prof.pos > 0.5 ? 0 : (rng.next() - 0.5) * 0.4);
    if (e > bv) { bv = e; best = s; }
  }
  return best;
}

// Should the incoming player ask for the balls to be replaced after a miss?
export function wantsReplay(fAfter, wAfter, prof) {
  if (prof.pos < 0.3) return false;
  const e = easeFor(fAfter, wAfter);
  return e.ease < 0.12 || !!e.snookered;
}
void isRed; void VALUE; void nameOf; void CUEID; void other; void placeCue; void canSeeBallOn; void settle; void powerToSpeed; void BAULK_Y; void D_R; void ballsOn;
