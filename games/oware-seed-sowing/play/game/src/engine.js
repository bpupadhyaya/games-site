// The computer's brain: negamax + alpha-beta + a transposition table + iterative deepening, on the SAME `sow` as the
// rule book. Work is counted in NODES, never in time (the game must stay deterministic). The search is a generator
// that pauses between small subtrees, so `createThinker(...).step()` costs only a few thousand nodes per frame and the
// game never stutters. Repetition and the 100-move cut-off are ignored inside the search (they only matter in very long games).
import { sow, legalMoves, seedsOn, sideOf, HALF, WIN } from './rules.js';

// depth: plies looked ahead; budget: total nodes for the whole move; noise: chance of a random legal move instead.
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 200, noise: 0.45, blurb: 'Looks one move ahead and often overlooks a capture.' },
  { name: 'Medium', depth: 3, budget: 4000, noise: 0.12, blurb: 'Looks about three moves ahead.' },
  { name: 'Hard', depth: 6, budget: 60000, noise: 0.02, blurb: 'Looks about six moves ahead.' },
  { name: 'Master', depth: 12, budget: 150000, noise: 0, blurb: 'Searches up to twelve moves ahead.' },
  { name: 'Grandmaster', depth: 24, budget: 500000, noise: 0, blurb: 'Searches as deep as it can: very hard to beat.' },
];
const BIG = 100000, GEN_PLIES = 4, SUBTREE_CAP = 3000, YIELD_AT = 1500;

const fromGame = (g) => ({ p: g.pits.slice(), s: g.store.slice(), turn: g.turn });

// children of a node, best-looking first (captures, then feeding)
function expand(n) {
  const moves = legalMoves(null, n.p, n.turn), out = [];
  for (const m of moves) {
    const p = n.p.slice(), r = sow(p, n.turn, m), s = n.s.slice();
    s[n.turn] += r.gain;
    out.push({ m, gain: r.gain, node: { p, s, turn: 1 - n.turn } });
  }
  out.sort((a, b) => b.gain - a.gain);
  return out;
}

// static value for the side to move
function evaluate(n) {
  const me = n.turn, op = 1 - me, p = n.p;
  let mine = 0, theirs = 0, vm = 0, vt = 0;
  for (let i = 0; i < 6; i++) {
    const a = p[me * 6 + i], b = p[op * 6 + i];
    mine += a; theirs += b;
    if (a === 1 || a === 2) vm++;          // my low pits can be captured
    if (b === 1 || b === 2) vt++;          // theirs I might capture
    if (a >= 12) mine += 3;                // a big house is a lap-and-capture threat
    if (b >= 12) theirs += 3;
  }
  return 100 * (n.s[me] - n.s[op]) + 3 * (mine - theirs) + 9 * (vt - vm);
}

function terminal(n, depth) {                   // value for the side to move, or null
  const me = n.turn, op = 1 - me;
  if (n.s[me] >= WIN) return BIG + depth;
  if (n.s[op] >= WIN) return -BIG - depth;
  return null;
}
function collected(n, depth) {                  // no legal move: each side keeps its own seeds
  const a = n.s[n.turn] + seedsOn(n.p, n.turn), b = n.s[1 - n.turn] + seedsOn(n.p, 1 - n.turn);
  return a > b ? BIG + depth : a < b ? -BIG - depth : 0;
}

export function createThinker(g, levelIndex, rng, opts = {}) {
  const L = { ...LEVELS[levelIndex], ...opts };
  const root = fromGame(g), roots = expand(root);
  const c = { nodes: 0, sub: 0, abort: false, tt: new Map() };
  const only = roots.length === 1;
  // Plain recursive search below the generator plies.
  function ab(n, depth, alpha, beta) {
    c.nodes++;
    if (c.nodes > L.budget || c.nodes > c.sub) { c.abort = true; return 0; }
    const t = terminal(n, depth); if (t !== null) return t;
    if (depth <= 0) return evaluate(n);
    const k = n.p.join(',') + '|' + n.turn + '|' + (n.s[0] - n.s[1]);
    const hit = c.tt.get(k);
    let first = -1;
    if (hit) {
      first = hit.m;
      if (hit.d >= depth) { if (hit.f === 0) return hit.v; if (hit.f === 1 && hit.v >= beta) return hit.v; if (hit.f === 2 && hit.v <= alpha) return hit.v; }
    }
    const kids = expand(n);
    if (kids.length === 0) return collected(n, depth);
    if (first >= 0) { const i = kids.findIndex((x) => x.m === first); if (i > 0) kids.unshift(kids.splice(i, 1)[0]); }
    let best = -Infinity, bm = -1; const a0 = alpha;
    for (const kd of kids) {
      const v = -ab(kd.node, depth - 1, -beta, -alpha);
      if (c.abort) return 0;
      if (v > best) { best = v; bm = kd.m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    c.tt.set(k, { d: depth, v: best, m: bm, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
    return best;
  }
  // Generator search for the first plies: pauses between subtrees.
  function* gab(n, depth, alpha, beta, ply) {
    if (ply >= GEN_PLIES) {
      c.sub = c.nodes + SUBTREE_CAP;
      const v = ab(n, depth, alpha, beta);
      if (c.nodes - c.lastYield >= YIELD_AT) { c.lastYield = c.nodes; yield; }
      return v;
    }
    c.nodes++;
    const t = terminal(n, depth); if (t !== null) return t;
    if (depth <= 0) return evaluate(n);
    const kids = expand(n);
    if (kids.length === 0) return collected(n, depth);
    let best = -Infinity;
    for (const kd of kids) {
      const v = -(yield* gab(kd.node, depth - 1, -beta, -alpha, ply + 1));
      if (c.abort) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  function* run() {
    c.lastYield = 0;
    let bestMove = roots[0]?.m, bestScore = 0, order = roots.slice();
    const maxDepth = only ? 0 : L.depth;
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -Infinity, cur = -1, curScore = -Infinity;
      for (const kd of order) {
        const v = -(yield* gab(kd.node, d - 1, -BIG * 2, -alpha, 1));
        if (c.abort) break;
        if (v > curScore) { curScore = v; cur = kd.m; }
        if (v > alpha) alpha = v;
      }
      if (c.abort) { if (d === 1 && cur < 0) cur = bestMove; else break; }
      bestMove = cur; bestScore = curScore;
      const i = order.findIndex((x) => x.m === bestMove); if (i > 0) order.unshift(order.splice(i, 1)[0]);
      if (Math.abs(bestScore) >= BIG) break;           // a forced result: no need to look deeper
      c.abort = false;
    }
    // level noise: sometimes a random legal move (deterministic: env.rng)
    if (L.noise > 0 && rng && roots.length > 1 && rng.chance(L.noise)) bestMove = rng.pick(roots).m;
    return { move: bestMove, score: bestScore, nodes: c.nodes };
  }
  const gen = run();
  let result = null;
  return {
    // one slice of thinking; returns {} while working and { move, score, nodes } when done (move is a pit, or -1 if none)
    step() {
      if (result) return result;
      if (roots.length === 0) return (result = { move: -1, score: 0, nodes: 0 });
      const r = gen.next();
      if (r.done) result = r.value;
      return r.done ? result : {};
    },
    nodes: () => c.nodes,
  };
}

// Run to the end (tests, puzzles). Never call this in the play loop at high levels.
export function chooseMove(g, levelIndex, rng, opts) {
  const t = createThinker(g, levelIndex, rng, opts);
  for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; }
}
