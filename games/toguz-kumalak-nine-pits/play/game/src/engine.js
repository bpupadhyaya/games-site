// The computer's brain: negamax + alpha-beta + a transposition table + iterative deepening, on the SAME `sow` as the
// rule book. Work is counted in NODES, never in time (the game must stay deterministic). The search is a generator
// that pauses between small subtrees, so `createThinker(...).step()` costs only a couple of thousand nodes per frame and the
// game never stutters. Toguz Kumalak branches up to nine ways, so the deep levels lean on move ordering (captures and tuz first).
import { sow, legalMoves, sideSum, numberOf, WIN } from './rules.js';

// depth: plies looked ahead; budget: total nodes for the whole move; noise: chance of a random legal move instead.
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 200, noise: 0.4, blurb: 'Looks one move ahead and often overlooks a capture.' },
  { name: 'Medium', depth: 3, budget: 4000, noise: 0.1, blurb: 'Looks about three moves ahead.' },
  { name: 'Hard', depth: 5, budget: 40000, noise: 0.02, blurb: 'Looks about five moves ahead and values a tuz.' },
  { name: 'Master', depth: 8, budget: 120000, noise: 0, blurb: 'Searches up to eight moves ahead.' },
  { name: 'Grandmaster', depth: 14, budget: 420000, noise: 0, blurb: 'Searches as deep as it can: very hard to beat.' },
];
const BIG = 100000, SUB_DEPTH = 3, SUBTREE_CAP = 700, YIELD_AT = 350;

const fromGame = (g) => ({ p: g.pits.slice(), k: g.kazan.slice(), z: g.tuz.slice(), turn: g.turn });

// children of a node, best-looking first (captures and tuz, then the rest)
function expand(n) {
  const moves = legalMoves(null, n.p, n.turn), out = [];
  for (const m of moves) {
    const p = n.p.slice(), k = n.k.slice(), z = n.z.slice(), r = sow(p, k, z, n.turn, m, false);
    out.push({ m, gain: r.gain, node: { p, k, z, turn: 1 - n.turn } });
  }
  out.sort((a, b) => b.gain - a.gain);
  return out;
}

// static value for the side to move
function evaluate(n) {
  const me = n.turn, op = 1 - me, p = n.p;
  let v = 100 * (n.k[me] - n.k[op]);
  if (n.z[me] >= 0) v += 110 + 4 * (numberOf(n.z[me]) === 7 ? 3 : 0); if (n.z[op] >= 0) v -= 110;
  for (let i = 0; i < 9; i++) {
    const a = p[me * 9 + i], b = p[op * 9 + i];
    v += a - b;
    if (a & 1) v -= 1 + a * 0.5;                    // my odd pits turn even when hit: they can be taken
    if (b & 1) v += 1 + b * 0.5;
    if (a === 2 && n.z[op] < 0 && i !== 8) v -= 14;  // one more pebble makes a tuz for the opponent
    if (b === 2 && n.z[me] < 0 && i !== 8) v += 14;
  }
  return v;
}

function terminal(n, depth) {                   // value for the side to move, or null
  if (n.k[n.turn] >= WIN) return BIG + depth;
  if (n.k[1 - n.turn] >= WIN) return -BIG - depth;
  return null;
}
function collected(n, depth) {                  // the side to move has no pebbles: the other side keeps its own
  const a = n.k[n.turn], b = n.k[1 - n.turn] + sideSum(n.p, 1 - n.turn);
  return a > b ? BIG + depth : a < b ? -BIG - depth : 0;
}

export function createThinker(g, levelIndex, rng, opts = {}) {
  const L = { ...LEVELS[levelIndex], ...opts };
  const root = fromGame(g), roots = expand(root);
  const c = { nodes: 0, sub: 0, cut: false, abort: false, lastYield: 0, tt: new Map() };
  const only = roots.length === 1;
  const keyOf = (n) => n.p.join(',') + '|' + n.turn + '|' + n.k[0] + '|' + n.k[1] + '|' + n.z[0] + '|' + n.z[1];
  // Probe the table: returns { v } for a usable cutoff, else { first } (a move to try first) or {}.
  function probe(k, depth, alpha, beta) {
    const hit = c.tt.get(k); if (!hit) return {};
    if (hit.d >= depth) { if (hit.f === 0) return { v: hit.v }; if (hit.f === 1 && hit.v >= beta) return { v: hit.v }; if (hit.f === 2 && hit.v <= alpha) return { v: hit.v }; }
    return { first: hit.m };
  }
  const bring = (kids, first) => { if (first >= 0) { const i = kids.findIndex((x) => x.m === first); if (i > 0) kids.unshift(kids.splice(i, 1)[0]); } };
  // Plain recursive search for the last few plies. A subtree that outgrows its node cap is cut short with the static value
  // (never aborting the whole iteration) and is not stored in the table.
  function ab(n, depth, alpha, beta) {
    c.nodes++;
    if (c.nodes > L.budget) { c.abort = true; return 0; }
    if (c.nodes > c.sub) { c.cut = true; return evaluate(n); }
    const t = terminal(n, depth); if (t !== null) return t;
    if (depth <= 0) return evaluate(n);
    const k = keyOf(n), pr = probe(k, depth, alpha, beta);
    if (pr.v !== undefined) return pr.v;
    const kids = expand(n);
    if (kids.length === 0) return collected(n, depth);
    bring(kids, pr.first ?? -1);
    let best = -Infinity, bm = -1; const a0 = alpha;
    for (const kd of kids) {
      const v = -ab(kd.node, depth - 1, -beta, -alpha);
      if (c.abort) return 0;
      if (v > best) { best = v; bm = kd.m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (!c.cut) c.tt.set(k, { d: depth, v: best, m: bm, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
    return best;
  }
  // Generator search for the upper plies: pauses between small subtrees so a frame never stalls.
  function* gab(n, depth, alpha, beta) {
    if (depth <= SUB_DEPTH) {
      c.sub = c.nodes + SUBTREE_CAP; c.cut = false;
      const v = ab(n, depth, alpha, beta);
      if (c.nodes - c.lastYield >= YIELD_AT) { c.lastYield = c.nodes; yield; }
      return v;
    }
    c.nodes++;
    const t = terminal(n, depth); if (t !== null) return t;
    const k = keyOf(n), pr = probe(k, depth, alpha, beta);
    if (pr.v !== undefined) return pr.v;
    const kids = expand(n);
    if (kids.length === 0) return collected(n, depth);
    bring(kids, pr.first ?? -1);
    let best = -Infinity, bm = -1; const a0 = alpha;
    for (const kd of kids) {
      const v = -(yield* gab(kd.node, depth - 1, -beta, -alpha));
      if (c.abort) return 0;
      if (v > best) { best = v; bm = kd.m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    c.tt.set(k, { d: depth, v: best, m: bm, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
    return best;
  }
  function* run() {
    let bestMove = roots[0]?.m, bestScore = 0, order = roots.slice();
    const maxDepth = only ? 0 : L.depth;
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -Infinity, cur = -1, curScore = -Infinity;
      for (const kd of order) {
        const v = -(yield* gab(kd.node, d - 1, -BIG * 2, -alpha));
        if (c.abort) break;
        if (v > curScore) { curScore = v; cur = kd.m; }
        if (v > alpha) alpha = v;
      }
      if (c.abort) { if (d === 1 && cur < 0) cur = bestMove; else break; }
      bestMove = cur; bestScore = curScore;
      const i = order.findIndex((x) => x.m === bestMove); if (i > 0) order.unshift(order.splice(i, 1)[0]);
      if (Math.abs(bestScore) >= BIG) break;           // a forced result: no need to look deeper
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
