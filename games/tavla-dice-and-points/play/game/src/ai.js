// The computer's brain: an evaluation function plus a small, time-sliced search.
// Work is counted in evaluations, never in time, so the game stays deterministic. The search is a generator:
// createThinker(...).step() runs a slice (about SLICE evaluations) and returns, so a frame is never blocked.
import { BAR, OFF, expandRoll, allTurns, allHome, clone, dirOf, distOf, own, pips, stepsFor, key, applyStep } from './rules.js';

export const SLICE = 70;                 // evaluations per frame while the computer thinks
// Levels. shots: how exactly blots are judged (0 = guess, 1 = exact shot counting). noise: random error in equity.
// ply2: how many of the best candidates are re-checked against every opposing roll.
export const LEVELS = [
  { name: 'Beginner', blurb: 'Plays quickly and often misses a hit or leaves a checker exposed. Good for learning.', shots: 0, noise: 0.95, ply2: 0 },
  { name: 'Club',     blurb: 'Knows to hit, to make points and to avoid obvious danger, but still slips.',           shots: 0, noise: 0.22, ply2: 0 },
  { name: 'Expert',   blurb: 'Counts exactly how many rolls can hit a lone checker and builds blocking points.',       shots: 1, noise: 0,    ply2: 0 },
  { name: 'Master',   blurb: 'Expert judgement, then checks its best candidates against every roll you could throw.', shots: 1, noise: 0,    ply2: 6 },
];

const HOME_W = [0, 0.16, 0.22, 0.32, 0.46, 0.55, 0.5, 0.36, 0.22, 0.18, 0.14, 0.1, 0.08];   // value of holding a point at distance d from off
const ROLLS = []; for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push({ a, b, w: a === b ? 1 : 2 });

// how many of the 36 rolls let `att` hit a lone checker of the other side on index b
export function shotCount(s, att, b) {
  const dir = dirOf(att), srcs = [];
  if (s.bar[att] > 0) srcs.push(att === 0 ? 24 - b : b + 1);
  else for (let j = 0; j < 24; j++) if (own(s, att, j) > 0) { const d = (b - j) * dir; if (d > 0) srcs.push(d); }
  if (!srcs.length) return 0;
  const open = (i) => own(s, att, i) >= -1;             // the attacker can land there (not held by 2+ of the victim)
  const at = (d) => (s.bar[att] > 0 ? (att === 0 ? 24 - d : d - 1) : null);
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let c = 1; c <= 6; c++) {
    let hit = false;
    for (const d of srcs) {
      if (d === a || d === c) { hit = true; break; }
      if (a === c) { for (let k = 2; k <= 4 && d >= k * a; k++) if (d === k * a) { let ok = true; for (let m = 1; m < k && ok; m++) { const p = b - dir * (d - m * a); ok = p >= 0 && p <= 23 && open(p); } if (ok) hit = true; } }
      else if (d === a + c) {
        // needs one of the two orders to be open at the middle point
        const pa = b - dir * (d - a), pc = b - dir * (d - c);
        if ((pa >= 0 && pa <= 23 && open(pa)) || (pc >= 0 && pc <= 23 && open(pc))) hit = true;
      }
      if (hit) break;
    }
    if (hit) n += 1;
  }
  return n;
}

function structure(s, me, shotsMode, mover) {
  const op = 1 - me;
  let v = 0, run = 0, best = 0, blots = 0, opHome = 0;
  for (let i = 0; i < 24; i++) if (own(s, op, i) >= 2 && distOf(op, i) <= 6) opHome += 1;
  for (let k = 1; k <= 24; k++) {
    // walk by distance from my off-point, so runs are counted along my path
    const i = me === 0 ? k - 1 : 24 - k, n = own(s, me, i);
    if (n >= 2) {
      v += k <= 12 ? HOME_W[k] : k >= 19 ? (k >= 22 ? 0.12 : 0.3) : 0.05;      // my far points are anchors in the opponent's home
      if (n > 3) v -= 0.06 * (n - 3);
      run += 1; if (run > best) best = run;
    } else {
      run = 0;
      if (n === 1) {
        blots += 1;
        const cost = (25 - k) * 0.045 + 0.35 + 0.08 * opHome;
        const p = mover === me ? 0 : shotsMode ? shotCount(s, op, i) / 36 : 0.22;
        v -= p * cost + 0.02;
      }
    }
  }
  if (best >= 3) v += (best - 2) * 0.22 + (best >= 5 ? 0.5 : 0);
  // opponent on the bar: worth more the more of my home board is closed
  let closed = 0; for (let i = 0; i < 24; i++) if (own(s, me, i) >= 2 && distOf(me, i) <= 6) closed += 1;
  if (s.bar[op] > 0) v += 0.32 * s.bar[op] + 0.12 * closed * s.bar[op];
  if (s.bar[me] > 0) v -= (0.4 + 0.14 * opHome) * s.bar[me];
  return v;
}

// contact = the two armies still have to pass each other
export function contact(s) {
  let max0 = s.bar[0] ? 24 : -1, min1 = s.bar[1] ? -1 : 99;
  for (let i = 0; i < 24; i++) { if (s.board[i] > 0 && i > max0) max0 = i; if (s.board[i] < 0 && i < min1) min1 = i; }
  return min1 < max0;
}
// how good the position is for `me`, in rough "games won minus lost" units (about 0 = level)
export function evaluate(s, me, shotsMode = 1, mover = -1) {
  const race = (pips(s, 1 - me) - pips(s, me)) * 0.05 + (s.off[me] - s.off[1 - me]) * 0.02;
  if (!contact(s)) return race * 1.5;
  return race + structure(s, me, shotsMode, mover) - structure(s, 1 - me, shotsMode, mover);
}
export const winChance = (e) => 1 / (1 + Math.exp(-e * 1.05));

// Why a candidate turn is good, in words a beginner understands.
export function reasonFor(before, cand, side) {
  const st = cand.steps, after = cand.after, out = [];
  if (st.some((x) => x.hit)) out.push('It hits: sending a checker to the bar costs the opponent pips and a turn.');
  const made = st.find((x) => x.to !== OFF && own(after, side, x.to) === 2 && own(before, side, x.to) <= 1 && x.to !== undefined);
  if (made) out.push(`It makes point ${made.to + 1}: two checkers together cannot be hit and they block the opponent.`);
  if (st.some((x) => x.to === OFF)) out.push('It bears a checker off, the way to win the race.');
  if (st.some((x) => x.from === BAR)) out.push('It brings your checker back into play.');
  let blots = 0; for (let i = 0; i < 24; i++) if (own(after, side, i) === 1) blots += 1;
  if (!out.length) out.push(blots === 0 ? 'It is the safe play: no checker is left alone where it can be hit.' : 'It keeps the best balance of safety and progress.');
  else if (blots === 0 && out.length < 2) out.push('It also leaves no lone checker to hit.');
  return out.join(' ');
}

// Choose a turn. Yields now and then so a frame is never blocked. Returns { cand, scored }.
function* search(s, side, roll, level, rng) {
  const L = LEVELS[level], cands = allTurns(s, side, roll);
  yield;
  if (cands.length <= 1) return { cand: cands[0] || null, scored: cands.map((c) => ({ c, v: 0 })) };
  let work = 0;
  const scored = [];
  for (const c of cands) {
    scored.push({ c, v: evaluate(c.after, side, L.shots) + (L.noise ? (rng.next() - 0.5) * 2 * L.noise : 0) });
    if (++work % SLICE === 0) yield;
  }
  scored.sort((x, y) => y.v - x.v);
  if (L.ply2) {
    const top = scored.slice(0, L.ply2), op = 1 - side;
    for (const t of top) {
      let sum = 0;
      if (t.c.after.off[side] === 15) { t.v = 9; continue; }
      for (const r of ROLLS) {
        const replies = allTurns(t.c.after, op, expandRoll([r.a, r.b]), 300);
        yield;
        let bestOp = -99;
        if (!replies.length) bestOp = evaluate(t.c.after, op, 1, side);
        else for (const rp of replies) { const v = evaluate(rp.after, op, 1, side); if (v > bestOp) bestOp = v; if (++work % SLICE === 0) yield; }
        sum += r.w * (-bestOp);
      }
      t.v = 0.6 * t.v + 0.4 * (sum / 36);
    }
    scored.sort((x, y) => y.v - x.v);
  }
  return { cand: scored[0].c, scored };
}

export function createThinker(s, side, roll, level, rng) {
  const it = search(clone(s), side, roll, level, rng);
  let done = null;
  return { step() { if (done) return done; const r = it.next(); if (r.done) { done = { done: true, ...r.value }; return done; } return { done: false }; } };
}
export function thinkAll(s, side, roll, level, rng) { const t = createThinker(s, side, roll, level, rng); let r; do { r = t.step(); } while (!r.done); return r; }

// Would the computer offer the cube / take it? (score only, no wagering)
export const cubeOffer = (s, me) => winChance(evaluate(s, me, 1)) >= 0.7 && contact(s) === true;
export const cubeTake = (s, me) => winChance(evaluate(s, me, 1)) >= 0.27;
export { stepsFor, applyStep, key, OFF };
