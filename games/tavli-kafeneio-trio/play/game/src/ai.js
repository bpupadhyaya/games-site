// The computer's brain: a self-play-trained neural network for Portes (net.js), a hand-built evaluation with self-play-tuned weights for Plakoto and Fevga, plus a
// small time-sliced search. Work is counted in evaluations, never in time, so the game stays deterministic. The search is a
// generator: createThinker(...).step() runs a slice (about SLICE evaluations) and returns, so a frame is never blocked.
import { BAR, OFF, PORTES, PLAKOTO, FEVGA, expandRoll, allTurns, clone, idxAt, distAt, top, mine, pips, stepsFor, key, applyStep, isOver } from './rules.js';
import { WEIGHTS } from './weights.js';
import { netEquity } from './net.js';
import { PORTES_NET } from './portesnet.js';

export const SLICE = 200;                // evaluations per frame while the computer thinks (a millisecond or two of work on a phone)
// Levels. shots: how exactly lone checkers are judged (0 = a flat guess, 1 = exact shot counting). noise: random error in the
// evaluation (portesNoise: the same for Portes, whose network judges positions on a finer scale). ply2: how many of the best candidates are re-checked against every opposing roll (a real two-ply look-ahead).
export const LEVELS = [
  { name: 'Beginner', blurb: 'Plays quickly and often misses a good move. Good for learning.', shots: 0, noise: 0.9, portesNoise: 0.55, ply2: 0 },
  { name: 'Club',     blurb: 'Knows the basics of all three games, but still slips.',            shots: 0, noise: 0.2, portesNoise: 0.3, ply2: 0 },
  { name: 'Expert',   blurb: 'Counts the rolls that can hurt it and plays the tuned strategy.',   shots: 1, noise: 0,   ply2: 0 },
  { name: 'Master',   blurb: 'Expert judgement, then checks its best moves against every reply.', shots: 1, noise: 0,   ply2: 8, blend: 0.5 },
];

// can `att` put a checker on distance `dist` of its own path (used to test the middle point of a two-dice move)
function openFor(s, att, dist) {
  if (dist < 1 || dist > 24) return false;
  const i = idxAt(s.v, att, dist), o = 1 - att, ot = top(s, o, i);
  if (s.v === PORTES) return ot <= 1;
  if (s.v === PLAKOTO) return ot === 0 || (ot === 1 && s.pin[i] === 0);
  return ot === 0;
}
// how many of the 36 rolls let `att` land on the lone checker standing on index b
export function shotCount(s, att, b) {
  const v = s.v, Dt = distAt(v, att, b), srcs = [];
  if (v === PORTES && s.bar[att] > 0) srcs.push(25 - Dt);
  else for (let j = 0; j < 24; j++) if (top(s, att, j) > 0) { const d = distAt(v, att, j) - Dt; if (d > 0) srcs.push(d); }
  if (!srcs.length) return 0;
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let c = 1; c <= 6; c++) {
    let hit = false;
    for (const d of srcs) {
      const Dj = Dt + d;
      if (d === a || d === c) { hit = true; break; }
      if (a === c) { for (let k = 2; k <= 4 && d >= k * a; k++) if (d === k * a) { let ok = true; for (let m = 1; m < k && ok; m++) ok = openFor(s, att, Dj - m * a); if (ok) hit = true; } }
      else if (d === a + c) { if (openFor(s, att, Dj - a) || openFor(s, att, Dj - c)) hit = true; }
      if (hit) break;
    }
    if (hit) n += 1;
  }
  return n;
}

// is there still contact: does any checker of one side still have to pass a checker of the other? (Portes / Plakoto)
export function contact(s) {
  if (s.v === FEVGA) return true;
  if (s.v === PLAKOTO) for (let i = 0; i < 24; i++) if (s.pin[i]) return true;
  let max0 = s.bar[0] ? 24 : -1, min1 = s.bar[1] ? -1 : 99;
  for (let i = 0; i < 24; i++) { if (s.board[i] > 0 && i > max0) max0 = i; if (s.board[i] < 0 && i < min1) min1 = i; }
  return min1 < max0;
}

// ---- Portes: evaluated by the trained network in net.js (see evaluate below) ----

// ---- Plakoto --------------------------------------------------------------------------------------------------------------------
function plakotoSide(s, me, shotsMode, mover, F) {
  const op = 1 - me, v = s.v;
  let pinsOn = 0, held = 0, stack = 0, risk = 0, blots = 0, block = 0;
  const opRear = (() => { let m = 0; for (let i = 0; i < 24; i++) if (top(s, op, i) > 0) m = Math.max(m, distAt(v, op, i)); return m; })();
  for (let i = 0; i < 24; i++) {
    const n = top(s, me, i), kd = distAt(v, me, i);
    if (s.pin[i] === op + 1) pinsOn += 0.5 + distAt(v, op, i) / 24;             // an opposing checker pinned under mine
    if (n >= 2) {
      held += 1; if (n > 4) stack += n - 4;
      const od = distAt(v, op, i); if (od < opRear) block += 1;                    // a held point the opposing rear still has to pass
    } else if (n === 1 && s.pin[i] === 0) {
      blots += 1;
      const p = mover === me ? 0 : shotsMode ? shotCount(s, op, i) / 36 : 0.25;
      risk += p * (0.45 + kd / 24 * 1.4);
    }
  }
  F[0] += pinsOn; F[1] += held; F[2] += stack; F[3] += risk; F[4] += block;
}
function plakotoFeatures(s, me, shotsMode, mover) {
  const F = new Array(8).fill(0), G = new Array(5).fill(0), H = new Array(5).fill(0);
  plakotoSide(s, me, shotsMode, mover, G); plakotoSide(s, 1 - me, shotsMode, mover, H);
  for (let k = 0; k < 5; k++) F[k] = G[k] - H[k];
  F[5] = (pips(s, 1 - me) - pips(s, me)) / 100; F[6] = (s.off[me] - s.off[1 - me]) / 15;
  F[7] = (mobility(s, me) - mobility(s, 1 - me)) / 20;
  return F;
}

// ---- Fevga ----------------------------------------------------------------------------------------------------------------------
const oneSide = (s) => (s.hl === 1 ? s : { ...s, hl: 1 });
function mobility(s, side) { let n = 0; for (let d = 1; d <= 6; d++) n += stepsFor(s, side, d).length; return n; }
function fevgaSide(s, me, F) {
  const op = 1 - me, v = s.v;
  let blocked = 0, wall = 0, head = 0, stack = 0, spread = 0, stuck = 0, homeN = 0;
  const occ = new Array(25).fill(false);                    // my occupied points, by the OPPONENT's distance
  for (let d = 1; d <= 24; d++) occ[d] = top(s, me, idxAt(v, op, d)) > 0;
  let opRear = 0;
  for (let i = 0; i < 24; i++) {
    const n = top(s, op, i);
    if (n > 0) {
      const d = distAt(v, op, i); if (d > opRear) opRear = d;
      let b = 0; for (let k = 1; k <= 6 && d - k >= 1; k++) if (occ[d - k]) b += 1;
      blocked += b * (n > 1 ? 1.2 : 1);
    }
  }
  let run = 0;
  for (let d = 1; d <= 24; d++) { if (occ[d]) { run += 1; if (d < opRear && run >= 3) wall += run - 2; } else run = 0; }
  for (let i = 0; i < 24; i++) {
    const n = top(s, me, i); if (n <= 0) continue;
    const k = distAt(v, me, i);
    spread += 1; if (k === 24) head += n; if (k <= 6) homeN += n; if (n > 3) stack += n - 3;
  }
  F[0] += blocked; F[1] += wall; F[2] += head; F[3] += stack; F[4] += spread; F[5] += homeN; F[6] += stuck;
}
function fevgaFeatures(s, me) {
  const t = oneSide(s), F = new Array(10).fill(0), G = new Array(7).fill(0), H = new Array(7).fill(0);
  fevgaSide(t, me, G); fevgaSide(t, 1 - me, H);
  for (let k = 0; k < 6; k++) F[k] = G[k] - H[k];
  F[6] = (pips(s, 1 - me) - pips(s, me)) / 100; F[7] = (s.off[me] - s.off[1 - me]) / 15;
  F[8] = (mobility(t, me) - mobility(t, 1 - me)) / 20;
  F[9] = (s.fresh[1 - me] ? 0 : 0);
  return F;
}

// How good the position is for `me`, in rough "games won minus lost" units (about 0 = level). `mover` = the side about to move
// (its lone checkers are safe for this instant).
export function evaluate(s, me, shotsMode = 1, mover = 1 - me, W = WEIGHTS) {
  const v = s.v, w = W[v];
  if (v === PORTES) return netEquity(W.net || PORTES_NET, s, me);          // Portes: the self-play-trained network
  const racePips = (pips(s, 1 - me) - pips(s, me)) * 0.05 + (s.off[me] - s.off[1 - me]) * 0.02;
  if (v !== FEVGA && !contact(s)) return racePips * 1.5;
  const F = v === PLAKOTO ? plakotoFeatures(s, me, shotsMode, mover) : fevgaFeatures(s, me);
  let e = 0; for (let k = 0; k < F.length; k++) e += F[k] * (w[k] || 0);
  return e;
}
export const winChance = (e) => 1 / (1 + Math.exp(-e * 1.05));

const nameOf = (v) => ['Portes', 'Plakoto', 'Fevga'][v];
// Why a candidate turn is good, in words a beginner understands.
export function reasonFor(before, cand, side) {
  const st = cand.steps, after = cand.after, v = before.v, out = [];
  if (st.some((x) => x.hit)) out.push('It hits: sending a checker to the bar costs the opponent pips and a turn.');
  if (st.some((x) => x.pin)) out.push('It pins a lone opposing checker: that checker is frozen until you leave the point.');
  const made = st.find((x) => x.to !== OFF && x.to !== undefined && top(after, side, x.to) === 2 && top(before, side, x.to) <= 1);
  if (made && v !== FEVGA) out.push(`It makes point ${made.to + 1}: two checkers together cannot be hit or pinned, and they block the opponent.`);
  if (v === FEVGA) {
    const taken = st.find((x) => x.to !== OFF && top(before, side, x.to) === 0);
    if (taken) out.push(`It takes point ${taken.to + 1}: an occupied point is closed to the opponent, so you are building a wall.`);
    if (st.some((x) => x.from !== BAR && x.from !== OFF && distAt(v, side, x.from) === 24)) out.push('It brings a checker off the head so your army gets moving.');
  }
  if (st.some((x) => x.to === OFF)) out.push('It bears a checker off, the way to win the race.');
  if (st.some((x) => x.from === BAR)) out.push('It brings your checker back into play.');
  if (!out.length) {
    if (v === FEVGA) out.push('It keeps your checkers flexible and the opponent’s paths as blocked as possible.');
    else {
      let blots = 0; for (let i = 0; i < 24; i++) if (top(after, side, i) === 1 && after.pin[i] === 0) blots += 1;
      out.push(blots === 0 ? `It is the safe play: no checker is left alone where it can be ${v === PORTES ? 'hit' : 'pinned'}.` : 'It keeps the best balance of safety and progress.');
    }
  }
  return out.join(' ');
}

const ROLLS = []; for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push({ a, b, w: a === b ? 1 : 2 });

// Choose a turn. Yields now and then so a frame is never blocked. Returns { cand, scored }.
function* search(s, side, roll, level, rng, W) {
  const L = LEVELS[level], cands = allTurns(s, side, roll);
  yield;
  if (cands.length <= 1) return { cand: cands[0] || null, scored: cands.map((c) => ({ c, v: 0 })) };
  const noise = s.v === PORTES && L.portesNoise !== undefined ? L.portesNoise : L.noise;
  const cost = s.v === PORTES ? 1 : 5;                     // Plakoto and Fevga evaluations (mobility, shots) are several times dearer than the Portes network
  let work = 0, next = SLICE;
  const scored = [];
  for (const c of cands) {
    scored.push({ c, v: evaluate(c.after, side, L.shots, 1 - side, W) + (noise ? (rng.next() - 0.5) * 2 * noise : 0) });
    work += cost; if (work >= next) { next = work + SLICE; yield; }
  }
  scored.sort((x, y) => y.v - x.v);
  if (L.ply2) {
    const top2 = scored.slice(0, L.ply2), op = 1 - side;
    for (const t of top2) {
      let sum = 0;
      if (t.c.after.off[side] === 15) { t.v = 9; continue; }
      for (const r of ROLLS) {
        const replies = allTurns(t.c.after, op, expandRoll([r.a, r.b]), 120);
        work += cost * (3 + replies.length);                       // generating the replies costs about as much as a few evaluations
        let bestOp = -99;
        if (!replies.length) bestOp = evaluate(t.c.after, op, 1, side, W);
        else for (const rp of replies) { const v = evaluate(rp.after, op, 1, side, W); if (v > bestOp) bestOp = v; }
        sum += r.w * (-bestOp);
        if (work >= next) { next = work + SLICE; yield; }
      }
      t.v = (1 - L.blend) * t.v + L.blend * (sum / 36);
    }
    scored.sort((x, y) => y.v - x.v);
  }
  return { cand: scored[0].c, scored };
}

export function createThinker(s, side, roll, level, rng, W = WEIGHTS) {
  const it = search(clone(s), side, roll, level, rng, W);
  let done = null;
  return { step() { if (done) return done; const r = it.next(); if (r.done) { done = { done: true, ...r.value }; return done; } return { done: false }; } };
}
export function thinkAll(s, side, roll, level, rng, W = WEIGHTS) { const t = createThinker(s, side, roll, level, rng, W); let r; do { r = t.step(); } while (!r.done); return r; }
export { stepsFor, applyStep, key, OFF, isOver, nameOf, mobility, PLAKOTO, mine };
