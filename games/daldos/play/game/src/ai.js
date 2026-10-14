// The computer's brain: a small expectimax. Every throw is a chance node (1..4, equal odds), so it averages over what the rival may throw
// next and picks the move whose average outcome is best. Levels differ in depth and in how much noise blurs the choice. It never cheats on the stick.
import { legalMoves, applyMove, clone, count, isMid, HOME, TRACK, OUT_END } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 0, noise: 70, random: 0.3 },
  { name: 'Easy', depth: 1, noise: 22, random: 0.08 },
  { name: 'Strong', depth: 2, noise: 4, random: 0 },
  { name: 'Master', depth: 3, noise: 0, random: 0 },
];

// Chance (0..1) that `by` can capture a single spatula of `side` standing on middle step `step` with one throw.
export function hitChance(g, side, step) {
  if (!isMid(step) || count(g, side, step) !== 1) return 0;
  const their = 25 - step, seen = new Set();
  let n = 0;
  for (const p of g.pieces[1 - side]) {
    if (p <= 0 || p >= HOME || seen.has(p)) continue;
    seen.add(p);
    const d = their - p;
    if (d >= 1 && d <= 4) n++;
  }
  return n / 4;
}

// Static value for side `me` (higher is better).
export function evaluate(g, me) {
  if (g.winner === me) return 1e5; if (g.winner === 1 - me) return -1e5;
  const opp = 1 - me;
  let v = 0;
  for (const p of g.pieces[me]) v += p * 3 + (p === HOME ? 6 : 0);
  for (const p of g.pieces[opp]) v -= p * 3 + (p === HOME ? 6 : 0);
  for (let s = OUT_END + 1; s <= TRACK; s++) {
    const mine = count(g, me, s), theirs = count(g, opp, 25 - s);
    if (mine === 1) v -= hitChance(g, me, s) * (s * 3 + 12);
    if (mine === 2) v += 3;
    if (theirs === 1) v += hitChance(g, opp, 25 - s) * ((25 - s) * 3 + 12) * 0.8;
    if (theirs === 2) v -= 3;
  }
  // a spatula that has been stuck in the harbour is a loss of tempo only when the rival is far ahead; keep it mild
  if (g.turn === me) v += 1.5;
  return v;
}

function chance(g, me, depth) {
  // g is at a throw: average over 1..4
  let sum = 0;
  for (let r = 1; r <= 4; r++) {
    const h = clone(g); h.roll = r; h.phase = 'move'; h.rolls += 1;
    sum += afterThrow(h, me, depth);
  }
  return sum / 4;
}

function afterThrow(h, me, depth) {
  const ms = legalMoves(h);
  if (!ms.length) { const q = clone(h); q.phase = 'roll'; q.turn = 1 - q.turn; q.roll = 0; q.extra = false; return value(q, me, depth); }
  const mover = h.turn, maximise = mover === me;
  let best = maximise ? -Infinity : Infinity;
  for (const m of ms) {
    const q = clone(h); applyMove(q, m);
    const val = value(q, me, depth);
    if (maximise ? val > best : val < best) best = val;
  }
  return best;
}

function value(g, me, depth) {
  if (g.winner >= 0 || depth <= 0) return evaluate(g, me);
  return chance(g, me, depth - 1);
}

// Best move for the side to move (a throw is already on the table). `rng` supplies the noise and the beginner's slips.
export function bestMove(g, level, rng) {
  const ms = legalMoves(g);
  if (!ms.length) return null;
  if (ms.length === 1) return ms[0];
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], me = g.turn;
  if (lv.random && rng.chance(lv.random)) return ms[rng.int(ms.length)];
  let best = null, bestV = -Infinity;
  for (const m of ms) {
    const q = clone(g); applyMove(q, m);
    let val = value(q, me, lv.depth);
    if (m.cap) val += 6;
    if (lv.noise) val += (rng.next() - 0.5) * 2 * lv.noise;
    if (val > bestV) { bestV = val; best = m; }
  }
  return best;
}
