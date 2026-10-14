// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { VARIANTS, WORK, legalMovesBounded, legalMovesGen, sideOf, isSultan } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 90, slip: 0.25 },
  { name: 'Easy', depth: 2, budget: 3000, margin: 45, slip: 0.07 },
  { name: 'Medium', depth: 4, budget: 16000, margin: 16, slip: 0 },
  { name: 'Hard', depth: 6, budget: 50000, margin: 6, slip: 0 },
  { name: 'Master', depth: 9, budget: 160000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 150, WSLICE = 1500;   // yield every SLICE nodes or WSLICE capture-search steps, whichever is first
const MAN = 100, SULTAN = 330;

// Move lists of the nodes searched by generators (the top plies, which iterative deepening and the opponent's reply keep coming back to)
// are cached per position (board + side to move). The leaf recursion below them is not cached: building the key costs more than expanding a
// quiet position. A capture search that needs more than BAIL_STEPS steps in one go (a position with thousands of tied Sultan chains) is not
// allowed to block the frame: it is redone as a generator that yields (legalAll). The cache never changes a result, only how soon it arrives.
const BAIL_STEPS = 2500, CACHE_MAX = 20000;
const CACHE = new Map();
const keyOf = (b, side) => side + b.join('');
function remember(k, moves) { if (CACHE.size >= CACHE_MAX) CACHE.clear(); CACHE.set(k, moves); }
// Plain call for the leaf recursion: the move list, or null when the position is too expensive to expand without yielding.
const legalSync = (b, n, alq, side) => legalMovesBounded(b, n, alq, side, BAIL_STEPS);
function* legalAll(b, n, alq, side) {
  const k = keyOf(b, side), hit = CACHE.get(k);
  if (hit) return hit.slice();
  let m = legalMovesBounded(b, n, alq, side, BAIL_STEPS);
  if (!m) m = yield* legalMovesGen(b, n, alq, side);
  remember(k, m);
  return m.slice();
}

function childBoard(b, n, m) {
  const c = Int8Array.from(b), piece = c[m.from];
  c[m.from] = 0; for (const q of m.caps) c[q] = 0;
  c[m.to] = m.promote ? piece + 2 : piece;
  return c;
}

// Static evaluation from `side`'s point of view: material first, then how far the men have walked, the centre, and a guarded back row.
function evaluate(b, n, side) {
  let v = 0;
  const mid = (n - 1) / 2;
  for (let i = 0; i < b.length; i++) {
    const p = b[i]; if (!p) continue;
    const s = sideOf(p), r = (i / n) | 0, c = i % n;
    let x;
    if (isSultan(p)) x = SULTAN + 6 - (Math.abs(r - mid) + Math.abs(c - mid)) * 1.5;
    else {
      const adv = s === 1 ? n - 1 - r : r;
      x = MAN + adv * (n === 5 ? 9 : 6) - Math.abs(c - mid) * 1.2;
      if (adv === 0) x += 7;                                      // a man still on its own back row keeps the gate shut
    }
    v += s === side ? x : -x;
  }
  return v;
}

function negamax(S, b, depth, alpha, beta, side, ply, ext) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const moves = legalSync(b, S.n, S.alq, side);
  if (!moves) { S.bail = true; S.stop = true; return 0; }                        // too expensive to expand here: the caller redoes it as a generator
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0) {
    if (moves[0].caps.length && ext < 4 && !S.stop) { depth = 1; ext++; }     // a capture is forced: look at it once more
    else return evaluate(b, S.n, side);
  }
  // captures first (they are all the legal moves when one exists), then the ones that walk furthest
  if (!moves[0].caps.length) moves.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const score = -negamax(S, childBoard(b, S.n, moves[k]), depth - 1, -beta, -alpha, 3 - side, ply + 1, ext);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

// Every node with 2 or more plies left is searched by a generator that hands control back every SLICE nodes, so a frame never waits on a
// deep search; below that the plain recursion runs (small subtrees, a few hundred nodes). When the whole search reaches its hard node limit
// (3x the level's budget) thinking ends and the last COMPLETED depth decides.
const LEAF_DEPTH = 1;
function* gnegamax(S, b, depth, alpha, beta, side, ply, ext) {
  if (S.abort) return 0;
  if (depth <= LEAF_DEPTH) {
    S.budget = S.hard; S.stop = false;
    const r = negamax(S, b, depth, alpha, beta, side, ply, ext);
    if (S.bail) { S.bail = false; S.stop = false; return yield* gexpand(S, b, depth, alpha, beta, side, ply, ext); }
    if (S.stop) { S.abort = true; return 0; }
    if (S.nodes - S.mark >= SLICE || WORK.n - S.wmark >= WSLICE) { yield; S.mark = S.nodes; S.wmark = WORK.n; }
    return r;
  }
  return yield* gexpand(S, b, depth, alpha, beta, side, ply, ext);
}
// One node expanded with generators all the way down (its children go back through gnegamax).
function* gexpand(S, b, depth, alpha, beta, side, ply, ext) {
  S.nodes++;
  const moves = yield* legalAll(b, S.n, S.alq, side);
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0) {
    if (moves[0].caps.length && ext < 4) { depth = 1; ext++; }
    else return evaluate(b, S.n, side);
  }
  if (!moves[0].caps.length) moves.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const score = -(yield* gnegamax(S, childBoard(b, S.n, moves[k]), depth - 1, -beta, -alpha, 3 - side, ply + 1, ext));
    if (S.abort) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], v = VARIANTS[game.variant];
  const budget = v.n === 9 ? cfg.budget * 0.6 : cfg.budget;
  const S = { n: v.n, alq: v.alq, nodes: 0, stop: false, budget: Infinity, hard: budget * 3, abort: false, bail: false, mark: 0, wmark: 0 };
  const side = game.turn, b0 = Int8Array.from(game.board);
  let root = [], bestDone = null;
  function choose() {
    const list = bestDone || root;
    const top = Math.max(...list.map((r) => r.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)];
    const pool = list.filter((r) => r.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  // iterative deepening over the root moves, as a generator: yields every SLICE nodes, returns the chosen move
  function* run() {
    root = (yield* legalAll(b0, S.n, S.alq, side)).map((m) => ({ m, score: 0, rep: 0 }));
    if (root.length === 0) return null;
    if (root.length === 1) return root[0].m;                           // a forced move needs no thought
    for (const r of root) {                                            // discourage walking into a third repetition
      const after = childBoard(b0, S.n, r.m);
      r.child = after;
      r.rep = game.seen[Array.prototype.join.call(after, '') + (3 - side)] || 0;
    }
    let depth = 1;
    for (;;) {
      let alpha = -INF;
      for (const r of root) {
        let score = -(yield* gnegamax(S, r.child, depth - 1, -INF, -(alpha - cfg.margin - 1), 3 - side, 1, 0));
        if (S.abort) return (bestDone ? choose() : root[0]).m;
        score -= r.rep >= 2 ? 80 : 0;
        r.score = score; if (score > alpha) alpha = score;
      }
      bestDone = root.map((r) => ({ ...r }));
      root.sort((a, c) => c.score - a.score);
      const top = root[0].score;
      if (depth >= cfg.depth || S.nodes >= budget || top > WIN - 200) return choose().m;
      depth++;
    }
  }
  const gen = run(); let done = false, result = null;
  return {
    progress: () => Math.min(1, S.nodes / budget),
    step() {
      if (done) return { move: result };
      S.mark = S.nodes; S.wmark = WORK.n;
      const r = gen.next();
      if (r.done) { done = true; result = r.value; return { move: result }; }
      return { move: undefined };
    },
  };
}

// Convenience for tests and puzzles: run a thinker to completion.
export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
