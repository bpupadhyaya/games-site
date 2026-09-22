// The computer. Expectimax over the throw of the sticks: a choice node (the player to move picks a piece) alternates with a
// chance node (the sticks). Written as generators so a search can be paused every few thousand nodes and resumed on the next frame,
// which keeps the screen at full speed. Work is counted in NODES, never in time, so the game stays deterministic.
import { legalMoves, applyMove, clone, other, CHANCE, EXTRA, SAFE, HAPPY, endThrow } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 0, random: 1 },
  { name: 'Easy', depth: 1, random: 0.4 },
  { name: 'Medium', depth: 2, random: 0 },
  { name: 'Hard', depth: 3, random: 0 },
  { name: 'Master', depth: 4, random: 0 },
];
export const NODES_PER_STEP = 5000;
const WIN = 10000;

// Board value for `me`: progress, pieces home, safety and walls. Higher is better for me.
export function evaluate(g, me) {
  const foe = other(me), b = g.board;
  let v = 0;
  v += (g.off[me - 1] - g.off[foe - 1]) * 70;
  for (let i = 0; i < 30; i++) {
    const p = b[i]; if (!p) continue;
    const s = p === me ? 1 : -1;
    let x = (i + 1) * 2;                                  // progress
    if (i === HAPPY) x += 16;                             // ready to leave with a 5
    if (i >= 27) x += 8;                                  // waiting on an exact throw, but very close
    const prot = SAFE.includes(i) || (i > 0 && b[i - 1] === p) || (i < 29 && b[i + 1] === p);
    if (i > 0 && b[i - 1] === p && i < 29 && b[i + 1] === p) x += 6;   // middle of a wall of three
    if (prot) x += 4;
    else for (let d = 1; d <= 5 && i - d >= 0; d++) if (b[i - d] === 3 - p) x -= CHANCE[d] * d * 5;   // a swap would cost d squares
    v += s * x;
  }
  if (g.turn === me) v += 3;
  return v;
}

function* value(g, depth, me, counter) {
  if (g.winner !== null) return g.winner === me ? WIN + depth : -WIN - depth;
  if (++counter.n % NODES_PER_STEP === 0) yield;
  if (g.n === 0) {                                        // chance node: the sticks are about to be thrown
    if (depth <= 0) return evaluate(g, me);
    let sum = 0;
    for (let n = 1; n <= 5; n++) { const h = clone(g); h.n = n; sum += CHANCE[n] * (yield* value(h, depth, me, counter)); }
    return sum;
  }
  const moves = legalMoves(g);
  if (!moves.length) { const h = clone(g); endThrow(h); return yield* value(h, depth - 1, me, counter); }
  const maxing = g.turn === me; let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const h = clone(g); applyMove(h, m);
    const v = yield* value(h, depth - 1, me, counter);
    if (maxing ? v > best : v < best) best = v;
  }
  return best;
}

// Score every legal move for the current throw. `depth` = number of own/enemy moves looked ahead.
export function* scoreMoves(g, depth) {
  const me = g.turn, moves = legalMoves(g), counter = { n: 0 }, out = [];
  for (const m of moves) {
    const h = clone(g); applyMove(h, m);
    out.push({ m, v: yield* value(h, depth - 1, me, counter) });
  }
  return out;
}

// A time-sliced chooser: call step() once per frame; it returns {} until it has an answer, then { move } (move may be null: no legal move).
export function createThinker(g, level, rng) {
  const L = LEVELS[level], moves = legalMoves(g);
  if (!moves.length) return { step: () => ({ move: null }) };
  if (moves.length === 1) return { step: () => ({ move: moves[0] }) };
  if (L.depth === 0 || rng.chance(L.random)) { const m = rng.pick(moves); return { step: () => ({ move: m }) }; }
  const it = scoreMoves(clone(g), L.depth); let steps = 0;
  return {
    get steps() { return steps; },
    step() {
      steps++;
      const r = it.next();
      if (!r.done) return {};
      const scored = r.value; let best = scored[0];
      for (const s of scored) if (s.v > best.v) best = s;
      return { move: best.m, scored };
    },
  };
}
// Run a thinker to the end (tests, puzzle proofs).
export function chooseMove(g, level, rng) { const t = createThinker(g, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
