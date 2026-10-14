// Bhavai Pot Balance Dance: the simulation. Pure and deterministic: no DOM, no clock; time is the sum of dt handed to stepWorld().
//
// The head follows a target x through a spring with limited acceleration (a = W^2 (xt - x) - 2 W v). The tower of n pots is a tall,
// heavy, lightly damped sway:   theta'' = -Om2(n) theta - DAMP theta' - kappa(n) a cos(theta) + disturbance.
// A head acceleration swings the tower the other way, wind and wobble pump it near its own rhythm, and the sway has to be damped by
// moving the head under it. Footprints are judged on every dance beat.
import { ACTS, SLOTS, PHRASE, COUNT_IN, POT_MAX, choreography } from './courses.js';

export const PHYS = {
  W: 16, MAX_ACC: 14, X_MAX: 1.55, OM2: 3.2, OM2_N: 0.1, DAMP: 0.2, KAPPA: 0.07, KAPPA_N: 0.006,
  FALL0: 0.62, FALL_PER: 0.022, FALL_MIN: 0.4, GRACE: 1.1, KEEP: 0.3,
  PERFECT: 0.15, GOOD: 0.34, POT_THETA: 0.2, POT_OMEGA: 0.65, STEADY_THETA: 0.08, STEADY_OMEGA: 0.25, TURN_KICK: 0.35, TURN_OK: 0.25,
  PRACTICE_NOISE: 0.6, PRACTICE_FALL: 1.3, END_BEATS: 2,
};
export const om2Of = (n) => PHYS.OM2 / (1 + PHYS.OM2_N * n);
export const kappaOf = (n) => PHYS.KAPPA + PHYS.KAPPA_N * n;
export const SCORE = { perfect: 100, good: 60, steady: 5, pot: 250, turn: 60, finishPerPot: 100, comboStep: 8, comboMax: 24, multMax: 4 };
export const STAR_STEPS = [0.6, 0.85];
export const DEMO_RUNS = 3;
export const REVEAL_SECONDS = 2;
export const fallLimit = (n, practice = false) => Math.max(PHYS.FALL_MIN, PHYS.FALL0 - PHYS.FALL_PER * n) * (practice ? PHYS.PRACTICE_FALL : 1);
export const beatLen = (act) => 60 / act.bpm;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function actStats(act) {
  const b = choreography(act);
  return { beats: b.length, steps: b.filter((x) => x.type === 'step').length, pots: act.pots0 + act.potCues, turns: b.filter((x) => x.type === 'turn').length };
}

export function createWorld(ai, opts = {}) {
  const act = ACTS[ai], beats = choreography(act), bl = beatLen(act);
  const p = (k) => ((act.seed * (k + 3) * 2654435761) % 6283) / 1000;   // fixed phases per act: the same wind every time
  return {
    ai, act, beats, bl, mode: opts.mode ?? 'dance', practice: opts.mode === 'practice',
    t: 0, t0: COUNT_IN * bl, bi: 0, over: false, completed: false, endAt: 0, go: -1,
    x: 0, v: 0, xt: 0, th: 0, om: 0, n: act.pots0, nStart: act.pots0, grace: 0, lastTurnT: -9, turnCheck: null,
    ph: [p(1), p(2), p(3), p(4), p(5)],
    score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, stepsTotal: 0, falls: 0, potsAdded: 0, potsMissed: 0, turnsHeld: 0, steady: 0,
    events: [], judged: {}, beatCount: 0, lastJudge: null, bot: false, botState: {},
  };
}

export const beatTime = (W, i) => W.t0 + i * W.bl;
export const mult = (combo) => 1 + Math.min(SCORE.multMax - 1, Math.min(combo, SCORE.comboMax) / SCORE.comboStep);
export const totalBeats = (W) => W.beats.length;
export function beatIndexNow(W) { return Math.floor((W.t - W.t0) / W.bl); }

export function distAt(W, t, n) {
  const a = W.act, ph = W.ph, k = W.practice ? PHYS.PRACTICE_NOISE : 1;
  const base = a.noise * k * (1 + 0.05 * n);
  const wob = 0.5 * Math.sin(1.15 * t + ph[0]) + 0.3 * Math.sin(2.1 * t + ph[1]) + 0.2 * Math.sin(0.72 * t + ph[2]);
  const gust = a.wind * k * Math.sin(0.37 * t + ph[3]) * (0.55 + 0.45 * Math.sin(0.113 * t + ph[4]));
  return (base * wob + gust) * (t > W.t0 ? 1 : 0.3);
}
const disturbance = (W) => distAt(W, W.t, W.n);
export function windNow(W) {
  const a = W.act; return a.wind * Math.sin(0.37 * W.t + W.ph[3]) * (0.55 + 0.45 * Math.sin(0.113 * W.t + W.ph[4]));
}

const ev = (W, e) => { W.events.push(e); };

function judgeBeat(W, i) {
  const b = W.beats[i], P = PHYS;
  if (b.type === 'step') {
    W.stepsTotal += 1;
    const d = Math.abs(W.x - SLOTS[b.slot]);
    if (d <= P.PERFECT || d <= P.GOOD) {
      const perfect = d <= P.PERFECT;
      W.combo += 1; W.maxCombo = Math.max(W.maxCombo, W.combo);
      const pts = Math.round((perfect ? SCORE.perfect : SCORE.good) * mult(W.combo));
      W.score += pts; if (perfect) W.perfect += 1; else W.good += 1;
      W.judged[i] = perfect ? 'perfect' : 'good';
      ev(W, { type: 'step', q: perfect ? 'perfect' : 'good', pts, x: W.x, d, combo: W.combo, i });
      W.lastJudge = { q: perfect ? 'perfect' : 'good', i, t: W.t };
    } else {
      W.combo = 0; W.miss += 1;
      W.judged[i] = 'miss';
      ev(W, { type: 'step', q: 'miss', pts: 0, x: W.x, d, combo: 0, i });
      W.lastJudge = { q: 'miss', i, t: W.t };
    }
  } else if (b.type === 'pot') {
    if (W.n < POT_MAX && Math.abs(W.th) <= P.POT_THETA && Math.abs(W.om) <= P.POT_OMEGA) {
      W.n += 1; W.potsAdded += 1; W.score += Math.round(SCORE.pot * mult(W.combo));
      ev(W, { type: 'pot', ok: true, x: W.x, n: W.n, i });
    } else {
      W.potsMissed += 1; ev(W, { type: 'pot', ok: false, x: W.x, n: W.n, i });
    }
  } else if (b.type === 'turn') {
    const kick = b.dir * P.TURN_KICK * (1 + 0.04 * W.n);
    W.om += kick; W.lastTurnT = W.t; W.turnCheck = { t: W.t + W.bl * 1.2, i };
    ev(W, { type: 'turn', dir: b.dir, x: W.x, i });
  }
  if (b.type !== 'pot' && Math.abs(W.th) < P.STEADY_THETA && Math.abs(W.om) < P.STEADY_OMEGA) {
    W.score += SCORE.steady * W.n; W.steady += 1;
  }
  W.beatCount += 1;
  ev(W, { type: 'beat', i, beatType: b.type, k: b.k });
}

function physics(W, dt, cmd) {
  const P = PHYS;
  if (cmd && cmd.xt !== null && cmd.xt !== undefined) W.xt = clamp(cmd.xt, -P.X_MAX, P.X_MAX);
  const a = clamp(P.W * P.W * (W.xt - W.x) - 2 * P.W * W.v, -P.MAX_ACC, P.MAX_ACC);
  W.v += a * dt; W.x += W.v * dt;
  if (W.x > P.X_MAX) { W.x = P.X_MAX; if (W.v > 0) W.v = 0; }
  if (W.x < -P.X_MAX) { W.x = -P.X_MAX; if (W.v < 0) W.v = 0; }
  W.om += (-om2Of(W.n) * W.th - P.DAMP * W.om - kappaOf(W.n) * a * Math.cos(W.th) + disturbance(W)) * dt;
  W.th += W.om * dt;
  W.acc = a;
}

// One simulation step. cmd = { xt } (target head x in metres, or null to hold).
export function stepWorld(W, dt, cmd) {
  W.events.length = 0;
  if (W.over) return;
  const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / sub;
  for (let s = 0; s < sub; s++) {
    W.t += h;
    if (W.go < 0 && W.t >= 0) W.go = 0;
    physics(W, h, cmd);
    W.grace = Math.max(0, W.grace - h);
    // beat clock: the count-in then one judged beat every bl seconds
    const cnt = Math.floor(W.t / W.bl);
    if (W.t < W.t0 && cnt > (W.countSeen ?? -1)) { W.countSeen = cnt; ev(W, { type: 'count', n: cnt }); }
    while (W.bi < W.beats.length && W.t >= beatTime(W, W.bi)) { judgeBeat(W, W.bi); W.bi += 1; }
    if (W.turnCheck && W.t >= W.turnCheck.t) {
      if (Math.abs(W.th) < PHYS.TURN_OK && W.grace <= 0) { W.turnsHeld += 1; W.score += Math.round(SCORE.turn * mult(W.combo)); ev(W, { type: 'turnHeld', x: W.x }); }
      W.turnCheck = null;
    }
    // a fall: the top pot slips off and shatters, the dancer catches the rest
    if (W.grace <= 0 && Math.abs(W.th) > fallLimit(W.n, W.practice)) {
      const dir = Math.sign(W.th) || 1;
      ev(W, { type: 'fall', x: W.x, th: W.th, n: W.n, dir });
      W.n -= 1; W.falls += 1; W.combo = 0; W.grace = PHYS.GRACE;
      W.th = dir * Math.min(Math.abs(W.th), 0.2) * PHYS.KEEP; W.om *= 0.15;
      if (W.n <= 0) { W.over = true; W.completed = false; ev(W, { type: 'end', ok: false }); return; }
    }
    if (W.bi >= W.beats.length && !W.endAt) W.endAt = beatTime(W, W.beats.length - 1) + PHYS.END_BEATS * W.bl;
    if (W.endAt && W.t >= W.endAt) {
      W.over = true; W.completed = true;
      W.score += SCORE.finishPerPot * W.n;
      ev(W, { type: 'end', ok: true });
      return;
    }
  }
}

export function resultOf(W) {
  const act = W.act, total = Math.max(1, W.stepsTotal), hitRate = (W.perfect + W.good) / total, target = act.pots0 + act.potCues;
  let stars = 0;
  if (W.completed) {
    stars = 1;
    if (W.n >= Math.min(POT_MAX, target) - 1 && hitRate >= STAR_STEPS[0]) stars = 2;
    if (W.n >= Math.min(POT_MAX, target) && hitRate >= STAR_STEPS[1]) stars = 3;
  }
  return {
    ai: W.ai, completed: W.completed, score: W.score, stars, pots: W.n, target: Math.min(POT_MAX, target), time: W.t, hitRate,
    perfect: W.perfect, good: W.good, miss: W.miss, steps: W.stepsTotal, maxCombo: W.maxCombo, falls: W.falls, potsAdded: W.potsAdded,
    potsMissed: W.potsMissed, turnsHeld: W.turnsHeld, turns: W.beats.filter((b) => b.type === 'turn').length, steady: W.steady,
  };
}

// ---- the performer: the AI that dances Watch and Learn (and that tests drive) -------------------------------------------------------
// Where the head should be right now: glide from the last footprint to the next one so as to arrive on the beat.
export function nextStepBeat(W, from = W.bi) {
  for (let i = from; i < W.beats.length; i++) if (W.beats[i].type === 'step') return i;
  return -1;
}
// ---- the performer ------------------------------------------------------------------------------------------------------------
// The choreography is known in advance, so the performer plans a smooth head path through the footprints (plannedX), keeps a model
// tower swinging under that path (the sway the plan alone would cause) and feeds back only the *deviation* of the real tower and
// head from the model. `skill` blurs how well the sway is read (a lag).
const stepsOf = (W) => {
  if (W.stepIdx) return W.stepIdx;
  W.stepIdx = []; W.beats.forEach((b, i) => { if (b.type === 'step') W.stepIdx.push(i); });
  return W.stepIdx;
};
// The planned head path at time t: x, v, a. Between footprints a quintic over the free time before the beat; it rests otherwise.
export function plannedX(W, t) {
  const idx = stepsOf(W);
  if (!idx.length) return { x: 0, v: 0, a: 0 };
  let k = 0; while (k < idx.length && beatTime(W, idx[k]) <= t) k++;
  if (k >= idx.length) return { x: SLOTS[W.beats[idx[idx.length - 1]].slot], v: 0, a: 0 };
  const tB = beatTime(W, idx[k]), x1 = SLOTS[W.beats[idx[k]].slot];
  const tA = k > 0 ? beatTime(W, idx[k - 1]) : -1e9, x0 = k > 0 ? SLOTS[W.beats[idx[k - 1]].slot] : x1;
  const span = Math.min(tB - tA, Math.max(W.bl * 2.2, 1.5)), s0 = tB - span, T = span;
  if (t <= s0) return { x: x0, v: 0, a: 0 };
  const u = clamp((t - s0) / T, 0, 1), d = x1 - x0;
  const e = u * u * u * (u * (u * 6 - 15) + 10), de = 30 * u * u * (u - 1) * (u - 1), d2 = 60 * u - 180 * u * u + 120 * u * u * u;
  return { x: x0 + d * e, v: (d * de) / T, a: (d * d2) / (T * T) };
}
// Pole placement (Ackermann) for the plant (x, v, theta, omega) with the spring-target xt as input.
export const POLES = [-1.6, -2.1, -2.8, -3.6];
const gainCache = new Map();
export function setPoles(arr) { POLES.length = 0; POLES.push(...arr); gainCache.clear(); }
export function gains(n) {
  const key = String(n);
  let K = gainCache.get(key);
  if (K) return K;
  const P = PHYS, W2 = P.W * P.W, om2 = om2Of(n), ka = kappaOf(n);
  const A = [[0, 1, 0, 0], [-W2, -2 * P.W, 0, 0], [0, 0, 0, 1], [ka * W2, ka * 2 * P.W, -om2, -P.DAMP]], B = [0, W2, 0, -ka * W2];
  const mul = (M, v) => M.map((r) => r.reduce((s, x, i) => s + x * v[i], 0));
  const cols = [B]; for (let i = 1; i < 4; i++) cols.push(mul(A, cols[i - 1]));
  const Mc = [0, 1, 2, 3].map((r) => cols.map((c) => c[r]));
  let poly = [1];
  for (const pole of POLES) { const m = new Array(poly.length + 1).fill(0); poly.forEach((c, i) => { m[i] += c; m[i + 1] -= c * pole; }); poly = m; }
  const matMul = (X, Y) => X.map((r) => Y[0].map((_, j) => r.reduce((s, x, k) => s + x * Y[k][j], 0)));
  let Pw = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], phiA = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i <= 4; i++) {
    const c = poly[4 - i];
    phiA = phiA.map((r, ri) => r.map((x, ci) => x + c * Pw[ri][ci]));
    Pw = matMul(Pw, A);
  }
  const m = 4, M = Mc.map((r) => r.slice()), inv = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));
  for (let c = 0; c < m; c++) {
    let piv = c; for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]]; [inv[c], inv[piv]] = [inv[piv], inv[c]];
    const d = M[c][c];
    for (let j = 0; j < m; j++) { M[c][j] /= d; inv[c][j] /= d; }
    for (let r = 0; r < m; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < m; j++) { M[r][j] -= f * M[c][j]; inv[r][j] -= f * inv[c][j]; } }
  }
  const last = inv[3];
  K = [0, 1, 2, 3].map((j) => last.reduce((s, x, i) => s + x * phiA[i][j], 0));
  gainCache.set(key, K);
  return K;
}
export function botCommand(W, skill = 1, dt = 1 / 60) {
  const P = PHYS, bs = W.botState, K = gains(W.n);
  const lag = W.botLag ?? (0.015 + (1 - skill) * 0.25), k = Math.min(1, dt / lag);
  bs.th = (bs.th ?? W.th) + (W.th - (bs.th ?? W.th)) * k;
  bs.om = (bs.om ?? W.om) + (W.om - (bs.om ?? W.om)) * k;
  const pl = plannedX(W, W.t);
  // the model tower under the planned acceleration (and the known kicks); keeps the plan's own sway out of the feedback
  if (bs.rt === undefined) { bs.rt = 0; bs.rw = 0; bs.rbi = 0; }
  const ka = kappaOf(W.n), om2 = om2Of(W.n);
  bs.rw += (-om2 * bs.rt - P.DAMP * bs.rw - ka * pl.a + distAt(W, W.t, W.n) * (0.4 + 0.6 * skill)) * dt;
  bs.rt += bs.rw * dt;
  while (bs.rbi < W.bi) { const b = W.beats[bs.rbi]; if (b && b.type === 'turn') bs.rw += b.dir * P.TURN_KICK * (1 + 0.04 * W.n); bs.rbi += 1; }
  const ff = pl.x + (pl.a + 2 * P.W * pl.v) / (P.W * P.W);
  const xt = ff - (K[0] * (W.x - pl.x) + K[1] * (W.v - pl.v) + K[2] * (bs.th - bs.rt) + K[3] * (bs.om - bs.rw));
  // and a little absolute damping of whatever sway there is, so the dance does not leave the tower swinging
  let near = 0.25;
  for (let i = W.bi; i < Math.min(W.beats.length, W.bi + 3); i++) if (W.beats[i].type === 'pot' || W.beats[i].type === 'turn') { near = 1.8; break; }
  const xd = xt + near * (BOT.cd * bs.om + BOT.ct * bs.th);
  return { xt: clamp(xd, -P.X_MAX, P.X_MAX) };
}
export const BOT = { cd: 0.12, ct: 0.12 };
export function desiredX(W) { const q = plannedX(W, W.t); return { x: q.x, v: q.v, a: q.a, ni: nextStepBeat(W) }; }

// The point on the floor under the tower's centre of mass: the spot the head should be at to stop a lean.
export function catchX(W) { return W.x + clamp(1.6 * W.th + 0.7 * W.om, -0.9, 0.9); }

// Phrases (Watch and Learn sections): the clock time at which each phrase's first beat falls.
export function sectionTimes(W) {
  const out = [0];
  for (let p = 1; p * PHRASE < W.beats.length; p++) out.push(beatTime(W, p * PHRASE) - W.bl * 0.9);
  return out;
}
