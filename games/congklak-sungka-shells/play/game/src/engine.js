// The computer's brain: negamax + alpha-beta + a transposition table + iterative deepening, on the SAME step() as the rule
// book. Work is counted in shell DROPS (one relay can be hundreds), never in time, so the game stays deterministic. The search
// is a generator that pauses every SLICE drops, so `createThinker(...).step()` costs a small, fixed amount per frame.
// An extra turn (ending in your own storehouse) keeps the same player to move, so the search does not flip the sign there.
import { machine, step as stepMachine, legalMoves, sideShells, SEQ, STORE, oppositeOf } from './rules.js';

// depth: plies of look-ahead; budget: total drops for the whole move; noise: chance of a random legal move instead.
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 6000, noise: 0.45, blurb: 'Looks one move ahead and often overlooks a capture.' },
  { name: 'Medium', depth: 2, budget: 60000, noise: 0.12, blurb: 'Looks two moves ahead.' },
  { name: 'Hard', depth: 4, budget: 500000, noise: 0.03, blurb: 'Looks about four moves ahead.' },
  { name: 'Master', depth: 8, budget: 3000000, noise: 0, blurb: 'Looks up to eight moves ahead.' },
  { name: 'Grandmaster', depth: 12, budget: 10000000, noise: 0, blurb: 'Searches as deep as its time allows: very hard to beat.' },
];
const BIG = 1e6, SLICE = 6000;

// play one house on a scratch board; returns the child node
function child(n, burnt, pl, h) {
  const b = n.b.slice(), s = { b, burnt }, m = machine(h);
  while (m.end === null) stepMachine(s, pl, m, null, 0);
  const extra = m.end === 'store', np = extra ? pl : 1 - pl;
  return { node: { b, turn: np }, gain: b[STORE[pl]] - n.b[STORE[pl]], extra, steps: m.steps + 1 };
}
const movesOf = (n, burnt) => SEQ[n.turn].filter((h) => n.b[h] > 0 && !burnt[h]);

// static value for the side to move (what the round would score for each side if it stopped now)
function evaluate(n, burnt) {
  const me = n.turn, op = 1 - me, b = n.b;
  const sm = sideShells(b, me), so = sideShells(b, op);
  let ex = 0;
  for (let i = 0; i < 7; i++) {
    const hm = SEQ[me][i], ho = SEQ[op][i];
    if (!burnt[hm] && b[hm] > 0 && b[hm] % 15 === (14 - i) % 15) ex++;             // lands in my storehouse: another turn
    if (!burnt[ho] && b[ho] > 0 && b[ho] % 15 === (14 - i) % 15) ex--;
  }
  return 10 * ((b[STORE[me]] + sm) - (b[STORE[op]] + so)) + 4 * (b[STORE[me]] - b[STORE[op]]) + 6 * ex;
}
function terminal(n) {                                    // the side to move has nothing to sow: the round ends, each side keeps what is on its side
  if (sideShells(n.b, n.turn) > 0) return null;
  const me = n.turn, op = 1 - me;
  const d = (n.b[STORE[me]] + sideShells(n.b, me)) - (n.b[STORE[op]] + sideShells(n.b, op));
  return d > 0 ? BIG + d : d < 0 ? -BIG + d : 0;
}

export function createThinker(g, levelIndex, rng, opts = {}) {
  const L = { ...LEVELS[levelIndex], ...opts }, burnt = g.burnt;
  const root = { b: g.b.slice(), turn: g.turn };
  const rootMoves = movesOf(root, burnt);
  const c = { work: 0, abort: false, tt: new Map(), next: SLICE };
  const order = (kids) => kids.sort((a, b) => (b.extra - a.extra) || (b.gain - a.gain));
  const expand = (n) => { const out = []; for (const h of movesOf(n, burnt)) { const k = child(n, burnt, n.turn, h); c.work += k.steps; out.push({ m: h, ...k }); } return order(out); };

  // one ply above the leaves: plain code (no generator cost)
  function leaf1(n, alpha, beta) {
    const t = terminal(n); if (t !== null) return t;
    let best = -Infinity;
    for (const h of movesOf(n, burnt)) {
      const k = child(n, burnt, n.turn, h); c.work += k.steps;
      const t2 = terminal(k.node);
      const v = t2 !== null ? (k.extra ? t2 : -t2) : (k.extra ? evaluate(k.node, burnt) : -evaluate(k.node, burnt));
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best;
  }
  function* gab(n, depth, alpha, beta) {
    if (c.abort) return 0;
    const t = terminal(n); if (t !== null) return t;
    if (depth <= 0) return evaluate(n, burnt);
    if (depth === 1) { const v = leaf1(n, alpha, beta); if (c.work > L.budget) c.abort = true; if (c.work >= c.next) { c.next = c.work + SLICE; yield; } return v; }
    const key = n.b.join(',') + '|' + n.turn, hit = c.tt.get(key); let first = -1;
    if (hit) { first = hit.m; if (hit.d >= depth) { if (hit.f === 0) return hit.v; if (hit.f === 1 && hit.v >= beta) return hit.v; if (hit.f === 2 && hit.v <= alpha) return hit.v; } }
    const kids = expand(n);
    if (first >= 0) { const i = kids.findIndex((x) => x.m === first); if (i > 0) kids.unshift(kids.splice(i, 1)[0]); }
    let best = -Infinity, bm = -1; const a0 = alpha;
    for (const kd of kids) {
      const v = kd.extra ? yield* gab(kd.node, depth - 1, alpha, beta) : -(yield* gab(kd.node, depth - 1, -beta, -alpha));
      if (c.abort) return 0;
      if (v > best) { best = v; bm = kd.m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    c.tt.set(key, { d: depth, v: best, m: bm, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
    if (c.work > L.budget) c.abort = true;
    if (c.work >= c.next) { c.next = c.work + SLICE; yield; }
    return best;
  }
  function* run() {
    let bestMove = rootMoves[0], bestScore = 0;
    const roots = expand(root);
    const maxDepth = rootMoves.length === 1 ? 0 : L.depth;
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -Infinity, cur = -1, curScore = -Infinity;
      for (const kd of roots) {
        const v = kd.extra ? yield* gab(kd.node, d - 1, alpha, BIG * 4) : -(yield* gab(kd.node, d - 1, -BIG * 4, -alpha));
        if (c.abort) break;
        if (v > curScore) { curScore = v; cur = kd.m; }
        if (v > alpha) alpha = v;
      }
      if (c.abort) { if (d === 1 && cur < 0) cur = bestMove; else break; }
      bestMove = cur; bestScore = curScore;
      const i = roots.findIndex((x) => x.m === bestMove); if (i > 0) roots.unshift(roots.splice(i, 1)[0]);
      if (Math.abs(bestScore) >= BIG) break;
      c.abort = false;
    }
    if (L.noise > 0 && rng && rootMoves.length > 1 && rng.chance(L.noise)) bestMove = rng.pick(rootMoves);
    return { move: bestMove, score: bestScore, work: c.work };
  }
  const gen = run();
  let result = null;
  return {
    // one slice of thinking; {} while working, { move, score, work } when done (move is a house, or -1 if none)
    step() {
      if (result) return result;
      if (rootMoves.length === 0) return (result = { move: -1, score: 0, work: 0 });
      const r = gen.next();
      if (r.done) result = r.value;
      return r.done ? result : {};
    },
    work: () => c.work,
  };
}
export function chooseMove(g, levelIndex, rng, opts) {
  const t = createThinker(g, levelIndex, rng, opts);
  for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; }
}

// ---- the simultaneous opening: the computer cannot see the human's house, so it picks the house whose solo run does best ---
export function chooseOpening(g, pl, levelIndex, rng) {
  const ms = legalMoves(g, pl);
  if (ms.length === 0) return -1;
  if (levelIndex === 0 || (rng && rng.chance(LEVELS[levelIndex].noise))) return rng ? rng.pick(ms) : ms[0];
  let best = ms[0], bs = -Infinity;
  for (const h of ms) {
    const s = { b: g.b.slice(), burnt: g.burnt }, m = machine(h);
    while (m.end === null) stepMachine(s, pl, m, null, 0);
    const score = m.gain * 2 + (m.end === 'store' ? 5 : 0) + (m.end === 'away' ? -1 : 0) + (rng ? rng.range(0, 0.5) : 0);
    if (score > bs) { bs = score; best = h; }
  }
  return best;
}
void oppositeOf;
