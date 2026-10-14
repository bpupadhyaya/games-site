// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
// Compulsory capture keeps the tree narrow: most positions have only a few legal moves, so the deep levels really do look far ahead.
import { genMoves, sideOf, isMaster, rowOf, colOf, SZ, N } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, child: 400, margin: 120, slip: 0.28 },
  { name: 'Easy', depth: 2, budget: 3000, child: 2000, margin: 60, slip: 0.08 },
  { name: 'Medium', depth: 4, budget: 25000, child: 5000, margin: 18, slip: 0 },
  { name: 'Hard', depth: 7, budget: 120000, child: 8000, margin: 6, slip: 0 },
  { name: 'Master', depth: 11, budget: 500000, child: 6000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1000;
const MAN = 100, MASTER = 330;
const ADV = [0, 5, 13, 30, 0];                                       // value of a man by rows advanced from his own home row (0..4)

function make(b, m) {
  b[m.from] = 0;
  for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = 0;
  b[m.to] = m.val;
}
function unmake(b, m, v) {
  b[m.to] = 0;
  for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = m.capVals[k];
  b[m.from] = v;
}

// Static value of the board from `side`'s point of view.
function evaluate(b, side) {
  let v = 0, mine = 0, theirs = 0;
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    const s = sideOf(p), r = rowOf(i), c = colOf(i);
    let x;
    if (isMaster(p)) x = MASTER + (2 - Math.abs(c - 2) + 2 - Math.abs(r - 2)) * 4;
    else {
      const adv = s === 1 ? N - 1 - r : r;                         // 0 at home, 4 on the far row
      x = MAN + ADV[adv] + (c === 2 ? 3 : 0);
      if (adv === 0) x += 6;                                       // a man still on the home row guards the way in
    }
    if (s === side) { v += x; mine++; } else { v -= x; theirs++; }
  }
  if (theirs === 0) return WIN;
  if (mine === 0) return -WIN;
  return v;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b;
  const moves = genMoves(b, side);
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0 && !(moves[0].caps.length && ply < 14)) return evaluate(b, side);   // a compulsory capture is always played out
  if (S.stop && depth <= 0) return evaluate(b, side);
  moves.sort((x, y) => y.caps.length - x.caps.length || y.val - x.val);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k], v = b[m.from];
    make(b, m);
    const score = -negamax(S, depth - 1, -beta, -alpha, 3 - side, ply + 1);
    unmake(b, m, v);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || (S.stop && depth > 0 && k >= 1)) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = { b: Int8Array.from(game.board), nodes: 0, stop: false, budget: Infinity }, side = game.turn;
  const root = genMoves(S.b, side).map((m) => ({ m, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  if (root.length === 1) return { step: () => ({ move: root[0].m }), progress: () => 1 };   // a forced move needs no thought
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  for (const r of root) {                                              // discourage walking into a third repetition
    const v = S.b[r.m.from]; make(S.b, r.m);
    r.rep = game.seen[Array.prototype.join.call(S.b, '') + (3 - side)] || 0;
    unmake(S.b, r.m, v);
  }
  root.sort((x, y) => y.m.caps.length - x.m.caps.length);
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
        const r = root[idx], before = S.nodes, v = S.b[r.m.from];
        make(S.b, r.m);
        S.budget = S.nodes + cfg.child; S.stop = false;                // one root move never costs more than a frame can afford
        const score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), 3 - side, 1) - (r.rep >= 2 ? 80 : 0);
        unmake(S.b, r.m, v);
        if (S.stop && bestDone) { done = true; result = choose(); return { move: result }; }   // this depth ran out of room: keep the last full one
        r.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
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
