// The computer's brain. Expectimax over the dice: my move, the enemy's roll (probabilities 1,4,6,4,1 of 16), the enemy's
// best reply, and so on. Written as a generator so a search can be paused every few hundred nodes and resumed on the
// next frame: the UI never waits for it. Work is counted in NODES, never in time, so the game stays deterministic.
import { ODDS, HOME, CENTRAL, clone, legalMoves, applyMove, pass, isRosette } from './rules.js';

export const LEVELS = [
  { name: 'Apprentice', depth: 0, greedy: true, blunder: 0.45, blurb: 'Grabs the obvious and often misses the point.' },
  { name: 'Scribe', depth: 1, blunder: 0.12, blurb: 'Weighs each move, but only for this turn.' },
  { name: 'Governor', depth: 1, blunder: 0.03, blurb: 'Looks at your reply, so it keeps its pieces out of reach.' },
  { name: 'Master', depth: 3, blunder: 0, blurb: 'Searches several moves ahead through every roll of the dice.' },
];

// How many pieces past "exposed to a hit" matter: a piece at p can be hit by an enemy piece d squares behind it
// (d = 1..4) with probability ODDS[d] / 16. Only the shared lane, and never the central rosette.
function exposure(mine, theirs) {
  let risk = 0;
  for (const p of mine) {
    if (p < 5 || p > 12 || p === CENTRAL) continue;
    let danger = 0;
    for (const q of theirs) { const d = p - q; if (q < p && d >= 1 && d <= 4) danger += ODDS[d] / 16; }
    risk += Math.min(1, danger) * (p + 1);
  }
  return risk;
}
// Value of a position for `side` (positive is good). Progress, safety, and the strength of holding the central rosette.
export function evaluate(g, side) {
  if (g.winner >= 0) return g.winner === side ? 1000 : -1000;
  const me = g.pos[side], op = g.pos[1 - side];
  let v = 0;
  for (const p of me) v += p + (p === HOME ? 3 : 0);
  for (const p of op) v -= p + (p === HOME ? 3 : 0);
  if (me.includes(CENTRAL)) v += 5; if (op.includes(CENTRAL)) v -= 5;
  v += exposure(op, me) * 0.85 - exposure(me, op) * 0.85;
  // pieces waiting cannot be hurt and keep options open, but a queue at home is a slow game: a small pull to bring pieces in
  v += me.filter((p) => p >= 1 && p <= 4).length * 0.3 - op.filter((p) => p >= 1 && p <= 4).length * 0.3;
  return v;
}

// The search. Yields to the caller every 200 nodes. Returns the value for `root`.
function* value(g, depth, root, counter) {
  if (g.winner >= 0) return g.winner === root ? 1000 : -1000;
  if (depth <= 0) return evaluate(g, root);
  if (g.roll < 0) {                                              // a chance node: someone rolls
    let sum = 0;
    for (let r = 0; r <= 4; r++) {
      const h = clone(g); h.roll = r;
      sum += (ODDS[r] / 16) * (yield* value(h, depth, root, counter));
    }
    return sum;
  }
  const moves = legalMoves(g);
  if (!moves.length) { const h = clone(g); pass(h); return yield* value(h, depth - 1, root, counter); }
  if ((++counter.n & 127) === 0) yield;
  const maxing = g.turn === root;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const h = applyMove(clone(g), m);
    const v = yield* value(h, depth - 1, root, counter);
    if (maxing ? v > best : v < best) best = v;
  }
  return best;
}
// Score every legal move of the position (the roll is already set). Resolves to [{ move, v }].
function* scoreMoves(g, depth) {
  const counter = { n: 0 }, out = [];
  for (const m of legalMoves(g)) {
    const h = applyMove(clone(g), m);
    out.push({ move: m, v: depth > 0 ? yield* value(h, depth, g.turn, counter) : evaluate(h, g.turn) });
  }
  return out;
}

// Why a move is good, in one plain sentence (used by hints and the daily puzzle).
export function explain(g, m) {
  if (m.hit >= 0) return 'It captures an enemy piece and sends it back to the start.';
  if (m.off) return 'It brings a piece home.';
  if (m.to === CENTRAL) return 'It takes the central rosette: safe, another roll, and it blocks the enemy lane.';
  if (m.rosette) return 'It lands on a rosette, which is safe and earns another roll.';
  const theirs = g.pos[1 - g.turn];
  if (m.from >= 5 && m.from <= 12 && theirs.some((q) => q < m.from && m.from - q <= 4) && !theirs.some((q) => q < m.to && m.to - q <= 4)) return 'It moves the piece out of the enemy\'s reach.';
  if (m.from === 0) return 'It brings a new piece onto the board without leaving anything exposed.';
  return 'It keeps your pieces safest while making progress.';
}

// A thinker searches over many frames. step(budget) runs about `budget` nodes' worth; result.move is undefined until done.
export function createThinker(g, level, rng) {
  const L = LEVELS[level] ?? LEVELS[1], moves = legalMoves(g);
  if (moves.length <= 1) return { step: () => ({ move: moves[0] ?? null }), nodes: 0 };
  const gen = scoreMoves(g, L.depth);
  const t = { nodes: 0, step(budget = 24) {
    for (let k = 0; k < budget; k++) {
      const r = gen.next(); t.nodes += 128;
      if (r.done) return { move: pick(g, r.value, L, rng) };
    }
    return { move: undefined };
  } };
  return t;
}
function pick(g, scored, L, rng) {
  if (L.greedy) {                                          // the Apprentice: likes captures, rosettes and going home, but often just picks
    const good = scored.filter((s) => s.move.hit >= 0 || s.move.off || s.move.rosette);
    if (good.length && !rng.chance(L.blunder)) return rng.pick(good).move;
    return rng.pick(scored).move;
  }
  scored.sort((a, b) => b.v - a.v);
  if (scored.length > 1 && rng.chance(L.blunder)) return scored[1 + rng.int(scored.length - 1)].move;
  const top = scored.filter((s) => s.v >= scored[0].v - 1e-9);
  return rng.pick(top).move;
}
// Run a search to the end at once (tests, puzzle proof, hints for tools). Returns the sorted scores.
export function bestMoves(g, depth) {
  const gen = scoreMoves(g, depth); let r;
  do { r = gen.next(); } while (!r.done);
  return r.value.sort((a, b) => b.v - a.v);
}
export function chooseMove(g, level, rng) { const t = createThinker(g, level, rng); let r; do { r = t.step(1e9); } while (r.move === undefined); return r.move; }
export { isRosette };
