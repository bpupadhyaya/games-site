// Egrang simulation: pure and deterministic. Units are metres and seconds; x runs along the road.
//
// FORWARD: the body is an inverted pendulum over the planted stilt. u = x - f (body position relative to the planted tip).
//   u'' = LAMBDA^2 (u - slope).  A tap swings the free stilt forward; it lands R ahead of the body, so stride = u(tap) + R.
//   Tapping at u = R keeps speed; later (bigger u) = faster and longer, closer to falling forward; earlier = slower and shorter.
// SIDEWAYS: w in [-1,1], w'' = KAPPA^2 w + kicks. The landing stilt catches it: w -= CATCH * p, where p is where on the
//   rail the player tapped (tap under the marker).
import { COURSES, tileAt, slopeAt, roughAt } from './courses.js';

export const PHYS = {
  R: 0.45, LAMBDA: 2.6, U_FALL: 0.82, SWING_T: 0.16, DRAG: 0.22, MUD_DRAG: 0.5, KAPPA: 1.5, W_FALL: 1.0, W_FALL_PLANK: 0.72,
  CATCH: 1.15, DOWN_T: 1.5, DOWN_T_PRACTICE: 0.7, MIN_GAP: 0.12, BUMP_RANGE: 1.1, BUMP_COOL: 4, START_U: -0.3, START_V: 1.05, COUNTDOWN: 3,
};
// Meter zones in u (what the step meter paints).
export const ZONES = { slow: 0.28, steady: 0.62, push: 0.72 };
export const GOOD_TILES = new Set(['road', 'grass', 'stone', 'plank', 'bund']);
export const SCORE = { perfect: 20, good: 8, chainStep: 5, chainMax: 8, place: [1000, 600, 300, 100], finish: 100, perSecond: 12 };
export const STAR_PLACE = [3, 2, 1, 1];            // stars for 1st..4th
export const TOK_U = 0.5;                         // the bamboo "tok" cue: the body passes this far over the planted stilt
export const DEMO_RUNS = 3;

// Where the body is when a tap made from (x, v) lands: the same pendulum, integrated over the swing time.
export function project(C, r, x, v) {
  const P = PHYS, drag = P.DRAG + (r.stuck ? P.MUD_DRAG : 0), n = Math.round(swingDur(r) * 60), dt = 1 / 60;
  for (let i = 0; i < n; i++) { v += P.LAMBDA * P.LAMBDA * (x - r.f - slopeAt(C, x)) * dt; v -= drag * v * dt; x += v * dt; }
  return x;
}
// The rear stilt trails the body: it stays planted until the body has moved on, then lifts and hangs behind (drawing + swing start).
export function trail(prevF, x) {
  const d = x - prevF, k = clamp((d - 0.3) / 0.6, 0, 1), e = k * k * (3 - 2 * k);
  return { x: prevF + (x - 0.4 - prevF) * e, lift: 0.26 * e };
}
export const swingDur = (r) => PHYS.SWING_T * (r.stuck ? 1.4 : 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const cosh = (x) => (Math.exp(x) + Math.exp(-x)) / 2;
const sinh = (x) => (Math.exp(x) - Math.exp(-x)) / 2;

// ---- creating a race ------------------------------------------------------------------------------------------------------------
export function newRacer(id, lane, look, skill, bot) {
  return {
    id, lane, look, skill, bot, x: 0, v: 0, f: 0, prevF: -1, w: 0, wv: 0, foot: 0, phase: 'ready', swingT: 0, sinceLand: 0, tapU: 0, tapP: 0,
    stuck: false, downT: 0, downKind: '', finished: false, finT: 0, steps: 0, perfect: 0, falls: 0, chain: 0, maxChain: 0, score: 0, bumpCool: 0,
    lastQ: '', ai: { target: 0.5, blind: false, noiseP: 0, wait: 0 }, sw0: { x: 0, lift: 0 }, standT: 0, trip: 0,
  };
}

export function createWorld(courseIndex, o, rng) {
  const course = COURSES[courseIndex];
  const mode = o.mode ?? 'race';                       // race | practice | auto
  const W = { course, ci: courseIndex, mode, rng, t: 0, go: -PHYS.COUNTDOWN, racers: [], events: [], over: false, overT: 0, assist: mode === 'practice' ? 1 : 0 };
  const lanes = rng.shuffle([0, 1, 2]);
  const skills = course.rivals.map((r) => r.skill);
  W.racers.push(newRacer(0, 3, o.playerLook ?? 0, 1, mode === 'auto'));
  course.rivals.forEach((r, i) => {
    const rc = newRacer(i + 1, lanes[i], r.look, skills[i] * (mode === 'practice' ? 0.7 : 1), true);
    rc.name = r.name;
    W.racers.push(rc);
  });
  W.racers[0].name = 'You';
  for (const r of W.racers) { r.f = PHYS.R - PHYS.START_U; r.x = 0; r.phase = 'ready'; r.ai.target = 0.5; }
  return W;
}

// ---- helpers the views use ------------------------------------------------------------------------------------------------------
export const uOf = (r) => r.x - r.f;
export const uPred = (W, r) => project(W.course, r, r.x, r.v) - r.f;   // the lean a tap right now would land with
export const isGood = (kind) => GOOD_TILES.has(kind);
// Predicted sideways marker at the moment a tap landed now.
export function wPredict(r, tau = swingDur(r), assist = false) {
  const k = PHYS.KAPPA * (assist ? 0.7 : 1);
  return clamp(r.w * cosh(k * tau) + (r.wv * sinh(k * tau)) / k, -1.3, 1.3);
}
// Where a tap right now plants the free stilt, in road metres.
export function landingX(W, r) { return project(W.course, r, r.x, r.v) + PHYS.R; }
export function wLimit(W, r) { return PHYS.W_FALL_PLANK * 0 + (tileAt(W.course, r.x) === 'plank' || tileAt(W.course, r.x) === 'bund' ? PHYS.W_FALL_PLANK : PHYS.W_FALL) * (W.assist ? 1.25 : 1); }

// ---- the AI (rivals, and the Watch and Learn performer) -------------------------------------------------------------------------
export function aiProfile(skill) {
  return { pace: 0.46 + 0.1 * skill, sdU: 0.16 * (1 - skill) + 0.015, sdP: 0.3 * (1 - skill) + 0.03, blind: 0.3 * (1 - skill) * (1 - skill), bump: 0.4 * skill };
}
// Choose the lean for the next tap so that the next three landings are all on good ground (a tiny depth-3 search).
const mudAhead = (C, x) => C.segs.some((g) => g.kind === 'mud' && g.x1 > x && g.x0 < x + 6);
function aiChoose(W, r, want) {
  const P = PHYS, C = W.course, steps = [];
  for (let u = 0.24; u <= 0.681; u += 0.02) steps.push(u);
  steps.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
  const good = (f) => isGood(tileAt(C, f)) && isGood(tileAt(C, f - 0.08)) && isGood(tileAt(C, f + 0.08));
  const ok = (f, depth) => {
    if (depth === 0) return true;
    for (const u of steps) { const nf = f + u + P.R; if (good(nf) && ok(nf, depth - 1)) return true; }
    return false;
  };
  for (const u of steps) {
    const nf = r.f + u + P.R;
    if (good(nf) && ok(nf, 2)) return u;
  }
  return want;
}
function aiPlan(W, r) {
  // Simulate the pendulum forward (no input) to find the earliest moment at/after the target lean where the landing tile is good.
  const P = PHYS, limit = P.U_FALL * (W.assist ? 1.2 : 1) - 0.1;
  let x = r.x, v = r.v, first = null;
  const dt = 1 / 30, drag = P.DRAG + (r.stuck ? P.MUD_DRAG : 0);
  for (let i = 0; i < 90; i++) {
    const xl = project(W.course, r, x, v), u = xl - r.f;       // the lean the body will have when the stilt lands
    if (u >= r.ai.target - 1e-6 || u >= limit) {
      const lx = xl + P.R, kind = r.ai.blind ? 'road' : tileAt(W.course, lx);
      if (!first) first = { wait: i * dt, x: lx, ok: isGood(kind) };
      if (isGood(kind) || u >= limit) return { wait: i * dt, x: lx, ok: isGood(kind) };
    }
    const sg = slopeAt(W.course, x);
    v += P.LAMBDA * P.LAMBDA * (x - r.f - sg) * dt; v -= drag * v * dt; x += v * dt;
    if (v < 0) break;
  }
  return first ?? { wait: 0, x: x, ok: false };
}
function aiCmd(W, r) {
  const plan = aiPlan(W, r);
  const urgent = Math.abs(wPredict(r)) > 0.68;      // a sideways fall is coming: plant the stilt now
  const cmd = { tap: (plan.wait < 1 / 60 + 1e-9 || urgent) && r.sinceLand >= PHYS.MIN_GAP, p: 0 };
  const prof = aiProfile(r.skill);
  cmd.p = clamp(wPredict(r) / PHYS.CATCH * 1.0 + r.ai.noiseP * prof.sdP, -1, 1);
  cmd.planX = plan.x;
  return cmd;
}
export function planFor(W, r) { return aiPlan(W, r); }

// ---- stepping --------------------------------------------------------------------------------------------------------------------
function fall(W, r, kind) {
  r.phase = 'down'; r.downKind = kind; r.downT = W.mode === 'practice' && r.id === 0 ? PHYS.DOWN_T_PRACTICE : PHYS.DOWN_T;
  r.falls += 1; r.chain = 0; r.standT = 0; r.v *= 0.2;
  W.events.push({ type: 'fall', who: r.id, kind, x: r.x });
}
function standUp(W, r) {
  r.phase = 'stance'; r.f = r.x + 0.3; r.prevF = r.f - 0.9; { const sg = slopeAt(W.course, r.x); r.v = Math.sqrt((tileAt(W.course, r.x) === 'mud' ? 1.5 : 0.49) + PHYS.LAMBDA * PHYS.LAMBDA * (0.3 + sg) * (0.3 + sg)); } r.w = 0; r.wv = 0; r.stuck = false; r.sinceLand = 0; r.swingT = 0;
  r.ai.target = 0.5; r.ai.noiseP = 0;
  r.ai.target = aiChoose(W, r, 0.5);
}
function land(W, r, p) {
  const P = PHYS, C = W.course, rng = W.rng;
  r.prevF = r.f; r.f = r.x + P.R; r.foot ^= 1; r.sinceLand = 0; r.steps += 1; r.phase = 'stance'; r.swingT = 0;
  const kind = tileAt(C, r.f), rough = roughAt(C, r.f) * (W.assist ? 0.55 : 1);
  r.stuck = false;
  let q = 'perfect';
  const sg = rng.chance(0.5) ? 1 : -1;
  if (kind === 'water') { fall(W, r, 'splash'); W.events.push({ type: 'splash', who: r.id, x: r.f }); return; }
  if (kind === 'hole') { r.v *= 0.8; r.w += 0.42 * sg; q = 'trip'; W.events.push({ type: 'trip', who: r.id, x: r.f }); }
  else if (kind === 'puddle') { r.w += 0.4 * sg; q = 'slip'; W.events.push({ type: 'slip', who: r.id, x: r.f }); }
  else if (kind === 'rock') { r.w += 0.3 * sg; r.v *= 0.85; q = 'trip'; W.events.push({ type: 'trip', who: r.id, x: r.f }); }
  else if (kind === 'mud') { r.stuck = true; r.v *= 0.9; q = 'good'; }
  r.w += rng.range(-1, 1) * rough * 0.22;
  r.w -= P.CATCH * p; r.wv *= 0.25;
  if (q === 'perfect' && (Math.abs(r.w) > 0.2 || r.tapU < 0.25 || r.tapU > 0.75)) q = 'good';
  r.lastQ = q;
  if (q === 'perfect') { r.perfect += 1; r.chain += 1; r.maxChain = Math.max(r.maxChain, r.chain); r.score += SCORE.perfect + SCORE.chainStep * Math.min(r.chain, SCORE.chainMax); }
  else if (q === 'good') { r.chain = Math.max(0, r.chain - 0); r.score += SCORE.good; }
  else r.chain = 0;
  W.events.push({ type: 'step', who: r.id, q, x: r.f, tapU: r.tapU, kind, chain: r.chain });
  // fresh AI intent for the next step
  const prof = aiProfile(r.skill);
  const sgn = slopeAt(C, r.f), sga = slopeAt(C, r.f + 4), vT = 1.5 + 0.4 * r.skill + (sga > 0.02 ? 0.4 : 0) + (mudAhead(C, r.f) ? 0.5 : 0);
  const rr = P.R + sgn, vm2 = Math.max(0, r.v * r.v - P.LAMBDA * P.LAMBDA * rr * rr);
  const need = sgn + Math.sqrt(rr * rr + Math.max(0, vT * vT - vm2 + (r.stuck ? 1.2 : 0.55)) / (P.LAMBDA * P.LAMBDA));
  let want = clamp(need + (rng.next() * 2 - 1) * prof.sdU * 1.7, 0.22, 0.68);
  if (!r.ai.blind) want = aiChoose(W, r, want);
  r.ai.target = want;
  r.ai.blind = rng.chance(prof.blind);
  r.ai.noiseP = rng.next() * 2 - 1;
}

function stepRacer(W, r, dt, cmd) {
  const P = PHYS, C = W.course;
  r.bumpCool = Math.max(0, r.bumpCool - dt);
  if (r.finished) { r.v *= 1 - 1.8 * dt; r.x += r.v * dt; r.standT += dt; return; }
  if (r.phase === 'ready') { r.standT += dt; return; }
  if (r.phase === 'down') { r.downT -= dt; r.standT += dt; if (r.downT <= 0) { standUp(W, r); W.events.push({ type: 'up', who: r.id, x: r.x }); } return; }
  const assist = W.assist && r.id === 0;
  r.sinceLand += dt;
  const u = r.x - r.f, sg = slopeAt(C, r.x), drag = P.DRAG + (r.stuck ? P.MUD_DRAG : 0);
  r.v += P.LAMBDA * P.LAMBDA * (u - sg) * dt; r.v -= drag * r.v * dt; r.x += r.v * dt;
  const kap = P.KAPPA * (assist ? 0.7 : 1) * ((tileAt(C, r.x) === 'plank' || tileAt(C, r.x) === 'bund') ? 1.25 : 1);
  r.wv += kap * kap * r.w * dt; r.w += r.wv * dt;
  const u2 = r.x - r.f;
  if (r.phase === 'stance') {
    if (cmd && cmd.tap && r.sinceLand >= P.MIN_GAP) { r.phase = 'swing'; r.swingT = 0; r.tapU = project(C, r, r.x, r.v) - r.f; r.tapP = clamp(cmd.p, -1.15, 1.15); r.sw0 = trail(r.prevF, r.x); r.tapped = true; }
  } else {
    r.swingT += dt;
    if (r.swingT >= P.SWING_T * (r.stuck ? 1.4 : 1)) {
      if (r.x - r.f > P.U_FALL * (assist ? 1.25 : 1) * 1.06) { fall(W, r, 'forward'); return; }
      land(W, r, r.tapP);
    }
    if (r.phase === 'down') return;
  }
  const uu = r.x - r.f, lim = P.U_FALL * (assist ? 1.25 : 1);
  if (r.phase === 'stance' && project(C, r, r.x, r.v) - r.f > lim) fall(W, r, 'forward');
  else if (uu < 0 && r.v <= 0.02) fall(W, r, 'back');
  else if (Math.abs(r.w) >= wLimit(W, r)) fall(W, r, 'side');
  if (r.phase !== 'down' && r.x >= C.length) {
    r.finished = true; r.finT = W.t; W.events.push({ type: 'finish', who: r.id, t: W.t });
  }
}

export function bump(W, a, b) {
  if (a.bumpCool > 0 || a.finished || b.finished || a.phase === 'down' || b.phase === 'down') return false;
  if (Math.abs(a.x - b.x) > PHYS.BUMP_RANGE) return false;
  a.bumpCool = PHYS.BUMP_COOL;
  const s = (a.lane - b.lane) > 0 ? -1 : 1;
  b.w += 0.42 * s * (W.mode === 'practice' && b.id !== 0 ? 0.4 : 1); b.v *= 0.94; a.w -= 0.18 * s;
  W.events.push({ type: 'bump', who: a.id, to: b.id, x: b.x });
  return true;
}
export function bumpTarget(W, a) {
  let best = null;
  for (const r of W.racers) {
    if (r === a || r.finished || r.phase === 'down') continue;
    const d = Math.abs(r.x - a.x);
    if (d <= PHYS.BUMP_RANGE && (!best || d < Math.abs(best.x - a.x))) best = r;
  }
  return best;
}

// cmd: the player's command { tap, p, bump } (ignored for a bot-controlled racer 0).
export function stepWorld(W, dt, cmd) {
  W.events.length = 0;
  if (W.over) return;
  W.t += dt;
  if (W.go < 0) {
    W.go += dt;
    const was = Math.ceil(-(W.go - dt));
    if (W.go >= 0) {
      for (const r of W.racers) { r.phase = 'stance'; r.x = 0; r.f = PHYS.R - PHYS.START_U * 0 + 0.0; r.f = -PHYS.START_U; r.v = PHYS.START_V; r.sinceLand = 0; }
      W.events.push({ type: 'go' });
      W.t = 0;
    } else if (Math.ceil(-W.go) !== was) W.events.push({ type: 'count', n: Math.ceil(-W.go) });
    for (const r of W.racers) r.standT += dt;
    return;
  }
  for (const r of W.racers) {
    let c = null;
    if (r.phase === 'stance' && r.bot) c = aiCmd(W, r);
    else if (r.id === 0) c = cmd;
    stepRacer(W, r, dt, c);
    if (r.bot && !r.finished && r.id !== 0 && r.phase !== 'ready' && r.phase !== 'down') {
      const prof = aiProfile(r.skill);
      if (r.bumpCool <= 0 && W.rng.chance(prof.bump * dt * 0.35)) { const tgt = bumpTarget(W, r); if (tgt && tgt.id === 0 && W.mode === 'race') bump(W, r, tgt); }
    }
  }
  // player bump
  const me = W.racers[0];
  if (cmd && cmd.bump && !me.bot) { const t = bumpTarget(W, me); if (t) bump(W, me, t); }
  if (W.mode === 'auto' && cmd && cmd.bump) { /* auto never bumps */ }
  // race end: when the player has finished and a short celebration passed, or everyone is done
  if (me.finished) { W.overT += dt; if (W.overT > 1.0) W.over = true; }
}

// Current ranking: finished racers by finish time, then the rest by distance.
export function standings(W) {
  return [...W.racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finT - b.finT;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.x - a.x;
  });
}
export function placeOf(W, id) { return standings(W).findIndex((r) => r.id === id); }

// ---- result and Watch and Learn sections -----------------------------------------------------------------------------------------
export function resultOf(W) {
  const me = W.racers[0], place = placeOf(W, 0);
  const score = Math.round(me.score + SCORE.place[place] + SCORE.finish + Math.max(0, (W.course.par - me.finT)) * SCORE.perSecond);
  return {
    ci: W.ci, mode: W.mode, place, stars: STAR_PLACE[place], time: me.finT, score, steps: me.steps, perfect: me.perfect, falls: me.falls, maxChain: me.maxChain,
    names: standings(W).map((r) => r.name),
  };
}
// Section boundaries for Watch and Learn: start, then a little before each feature cluster, and at least every 30 m.
export function sectionsOf(course) {
  const marks = [0];
  for (const f of course.features) { const x = Math.max(0, f.x0 - 7); if (x - marks[marks.length - 1] > 14) marks.push(x); }
  const out = [];
  for (const m of marks) { if (!out.length || m - out[out.length - 1] > 22) out.push(m); else out.push(m); }
  return out;
}
export function featureAhead(course, x, span = 16) {
  let best = null;
  for (const f of course.features) if (f.x1 > x && f.x0 < x + span && (!best || f.x0 < best.x0)) best = f;
  return best;
}
