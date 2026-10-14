// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
// A flip changes up to eight pieces at once, so the evaluation is dominated by the piece count and the search looks for cascades.
import { genMoves, countOf, hasDiagonals, rowOf, colOf, SZ } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 400, child: 500, margin: 140, slip: 0.3 },
  { name: 'Easy', depth: 2, budget: 4000, child: 2500, margin: 70, slip: 0.1 },
  { name: 'Medium', depth: 4, budget: 30000, child: 6000, margin: 22, slip: 0 },
  { name: 'Hard', depth: 6, budget: 560000, child: 6000, margin: 8, slip: 0 },
  { name: 'Master', depth: 9, budget: 2000000, child: 6000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1000;
const PIECE = 100;

function make(b, side, m) {
  b[m.from] = 0; b[m.to] = side;
  for (let k = 0; k < m.flips.length; k++) b[m.flips[k]] = side;
}
function unmake(b, side, m) {
  b[m.to] = 0; b[m.from] = side;
  const opp = 3 - side;
  for (let k = 0; k < m.flips.length; k++) b[m.flips[k]] = opp;
}

// Static value of the board from `side`'s point of view: pieces first, then where they stand (crossing points with diagonals are
// worth more, the centre most) and a little for room to move.
function evaluate(b, side) {
  let v = 0, mine = 0, theirs = 0;
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    let x = PIECE + (hasDiagonals(i) ? 6 : 0);
    if (i === 12) x += 5;
    if (rowOf(i) % 4 === 0 || colOf(i) % 4 === 0) x -= 2;
    if (p === side) { v += x; mine++; } else { v -= x; theirs++; }
  }
  if (theirs === 0) return WIN;
  if (mine === 0) return -WIN;
  return v;
}

// Flips swing the count hard, so a position is only judged once the flipping exchanges have played out.
function quiesce(S, alpha, beta, side, ply, open) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;                              // hard bound: the exchange search can never run past its slice
  const b = S.b, stand = evaluate(b, side);
  if (S.stop || ply > 14 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const moves = genMoves(b, side, open);
  let best = stand;
  for (const m of moves) {
    if (!m.flips.length) continue;
    make(b, side, m);
    const score = countOf(b, 3 - side) === 0 ? WIN - ply : -quiesce(S, -beta, -alpha, 3 - side, ply + 1, m.from);
    unmake(b, side, m);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(S, depth, alpha, beta, side, ply, open) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b;
  if (S.stop) return evaluate(b, side);                              // out of nodes: the caller discards this depth anyway
  if (depth <= 0) return quiesce(S, alpha, beta, side, ply, open);
  const moves = genMoves(b, side, open);
  if (moves.length === 0) return -(WIN - ply);
  moves.sort((x, y) => y.flips.length - x.flips.length);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    make(b, side, m);
    let score;
    if (countOf(b, 3 - side) === 0) score = WIN - ply;
    else score = -negamax(S, depth - 1, -beta, -alpha, 3 - side, ply + 1, m.from);
    unmake(b, side, m);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || (S.stop && depth > 0 && k >= 1)) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = { b: Int8Array.from(game.board), nodes: 0, stop: false, budget: Infinity }, side = game.turn;
  const open = game.last ? game.last.from : -1;
  const root = genMoves(S.b, side, open).map((m) => ({ m, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  if (root.length === 1) return { step: () => ({ move: root[0].m }), progress: () => 1 };   // a forced move needs no thought
  const budget = cfg.budget;
  let cur = null, depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  for (const r of root) {                                              // discourage walking into a third repetition
    make(S.b, side, r.m);
    r.rep = game.seen[Array.prototype.join.call(S.b, '') + (3 - side)] || 0;
    unmake(S.b, side, r.m);
  }
  root.sort((x, y) => y.m.flips.length - x.m.flips.length);
  function choose() {
    // pick among the moves within `margin` of the best completed score (seeded), with a small chance of a plain slip at the lowest level
    const list = bestDone || root;
    const top = Math.max(...list.map((r) => r.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)].m;
    const pool = list.filter((r) => r.score >= top - cfg.margin);
    return pool[rng.int(pool.length)].m;
  }
  return {
    progress: () => Math.min(1, used / budget),
    step() {
      if (done) return { move: result };
      let work = 0;
      while (work < SLICE) {
        if (idx >= root.length) {                                      // a depth finished: keep it, deepen
          bestDone = root.map((r) => ({ ...r }));
          root.sort((a, c) => c.score - a.score);
          const top = root[0].score;
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = choose(); return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const r = root[idx];
        if (!cur) {                                                    // begin one root move: it never costs more than `child` nodes in total
          make(S.b, side, r.m);
          S.budget = S.nodes + cfg.child; S.stop = false;
          cur = { before: S.nodes, score: null, replies: null, k: 0, best: -INF, a1: -INF, b1: -(alpha - cfg.margin - 1) };
          if (countOf(S.b, 3 - side) === 0) cur.score = WIN;
          else if (depth - 1 <= 0) cur.score = -negamax(S, 0, -INF, -(alpha - cfg.margin - 1), 3 - side, 1, r.m.from);
          else {
            S.nodes++; if (S.nodes > S.budget) S.stop = true;
            cur.replies = genMoves(S.b, 3 - side, r.m.from);
            if (S.stop) cur.score = -evaluate(S.b, 3 - side);
            else if (cur.replies.length === 0) cur.score = WIN - 1;
            else cur.replies.sort((x, y) => y.flips.length - x.flips.length);
          }
          work += 1;
        }
        if (cur.score === null) {                                      // one reply per slice of work: this is what keeps a frame short
          const opp = 3 - side, m2 = cur.replies[cur.k], before = S.nodes;
          make(S.b, opp, m2);
          const sc = countOf(S.b, side) === 0 ? WIN - 1 : -negamax(S, depth - 2, -cur.b1, -cur.a1, side, 2, m2.from);
          unmake(S.b, opp, m2);
          if (sc > cur.best) cur.best = sc; if (cur.best > cur.a1) cur.a1 = cur.best;
          const cutoff = cur.a1 >= cur.b1 || (S.stop && cur.k >= 1);
          cur.k++; work += S.nodes - before + 1;
          if (cutoff || cur.k >= cur.replies.length) cur.score = -cur.best;
        }
        if (cur.score === null) continue;
        const score = cur.score - (r.rep >= 2 ? 80 : 0), cost = S.nodes - cur.before; cur = null;
        unmake(S.b, side, r.m);
        if (S.stop && bestDone) { done = true; result = choose(); return { move: result }; }   // this depth ran out of room: keep the last full one
        r.score = score; if (score > alpha) alpha = score;
        idx++; used += cost + 1;
        if (used >= budget * 3) { done = true; result = bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0].m; return { move: result }; }
      }
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
