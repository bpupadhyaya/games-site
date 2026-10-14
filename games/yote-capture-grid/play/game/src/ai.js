// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
// Yote has no compulsory capture, so the tree is wide (every empty pit is a drop): the search narrows drops to pits near the action, keeps
// only the few most dangerous bonus choices per jump, and plays out jumps at the horizon (a quiescence extension) so it never stops
// halfway through an exchange.
import { genMoves, onBoard, SZ, ROWS, COLS, rowOf, colOf, HAND_BONUS, NO_BONUS } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, child: 400, margin: 140, slip: 0.3 },
  { name: 'Easy', depth: 2, budget: 4000, child: 2500, margin: 70, slip: 0.1 },
  { name: 'Medium', depth: 3, budget: 30000, child: 6000, margin: 24, slip: 0 },
  { name: 'Hard', depth: 4, budget: 120000, child: 4500, margin: 8, slip: 0 },
  { name: 'Master', depth: 6, budget: 450000, child: 4500, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1200, TOPK = 3, QMAX = 14;
const PIECE = 100, HANDBIT = 5;

function make(S, side, m) {
  const b = S.b, opp = 3 - side;
  if (m.kind === 'drop') { b[m.to] = side; S.hand[side]--; return; }
  b[m.from] = 0; b[m.to] = side;
  if (m.kind === 'jump') {
    b[m.cap] = 0;
    if (m.bonus >= 0) b[m.bonus] = 0; else if (m.bonus === HAND_BONUS) S.hand[opp]--;
  }
}
function unmake(S, side, m) {
  const b = S.b, opp = 3 - side;
  if (m.kind === 'drop') { b[m.to] = 0; S.hand[side]++; return; }
  b[m.to] = 0; b[m.from] = side;
  if (m.kind === 'jump') {
    b[m.cap] = opp;
    if (m.bonus >= 0) b[m.bonus] = opp; else if (m.bonus === HAND_BONUS) S.hand[opp]++;
  }
}

// Static value from `side`'s point of view: pebbles (a pebble in hand is worth a touch more: it cannot be taken as a bonus while others
// stand on the board), a little for the middle of the board.
function evaluate(S, side) {
  const b = S.b, opp = 3 - side;
  let mine = S.hand[side], theirs = S.hand[opp], pos = 0;
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    const r = rowOf(i), c = colOf(i), mid = 2 - Math.abs(r - 2) + 2.5 - Math.abs(c - 2.5);
    if (p === side) { mine++; pos += mid; } else { theirs++; pos -= mid; }
  }
  if (theirs === 0) return WIN;
  if (mine === 0) return -WIN;
  return (mine - theirs) * PIECE + (S.hand[side] - S.hand[opp]) * HANDBIT + pos * 1.5;
}

function order(moves) {
  // jumps first (a bonus-taking jump is the biggest swing), then steps, then drops
  const w = (m) => (m.kind === 'jump' ? (m.bonus === NO_BONUS ? 2 : 3) : m.kind === 'step' ? 1 : 0);
  return moves.sort((x, y) => w(y) - w(x));
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const opp = 3 - side;
  if (onBoard(S.b, side) + S.hand[side] === 0) return -(WIN - ply);
  if (onBoard(S.b, opp) + S.hand[opp] === 0) return WIN - ply;
  if (depth <= 0) {                                              // the horizon: let any open jump play out
    const stand = evaluate(S, side);
    if (ply >= QMAX || S.stop) return stand;
    const js = genMoves(S.b, S.hand, side, TOPK, true);
    if (!js.length) return stand;
    let best = stand; if (best > alpha) alpha = best; if (alpha >= beta) return best;
    for (const m of order(js)) {
      make(S, side, m);
      const score = -negamax(S, 0, -beta, -alpha, opp, ply + 1);
      unmake(S, side, m);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  const moves = genMoves(S.b, S.hand, side, TOPK);
  if (moves.length === 0) return -(WIN - ply);
  order(moves);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    make(S, side, m);
    const score = -negamax(S, depth - 1, -beta, -alpha, opp, ply + 1);
    unmake(S, side, m);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || (S.stop && k >= 1)) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = { b: Int8Array.from(game.board), hand: game.hand.slice(), nodes: 0, stop: false, budget: Infinity }, side = game.turn;
  const root = genMoves(S.b, S.hand, side, 4).map((m) => ({ m, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  if (root.length === 1) return { step: () => ({ move: root[0].m }), progress: () => 1 };
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  for (const r of root) {                                          // discourage walking into a third repetition
    make(S, side, r.m);
    r.rep = game.seen[Array.prototype.join.call(S.b, '') + '|' + S.hand[1] + ',' + S.hand[2] + '|' + (3 - side)] || 0;
    unmake(S, side, r.m);
  }
  const wt = (m) => (m.kind === 'jump' ? (m.bonus === NO_BONUS ? 2 : 3) : m.kind === 'step' ? 1 : 0);
  root.sort((x, y) => wt(y.m) - wt(x.m));
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
        if (idx >= root.length) {                                  // a depth finished: keep it, deepen
          bestDone = root.map((r) => ({ ...r }));
          root.sort((a, c) => c.score - a.score);
          const top = root[0].score;
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = choose(); return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const r = root[idx], before = S.nodes;
        make(S, side, r.m);
        S.budget = S.nodes + cfg.child; S.stop = false;            // one root move never costs more than a frame can afford
        const score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), 3 - side, 1) - (r.rep >= 2 ? 80 : 0);
        unmake(S, side, r.m);
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
export { ROWS, COLS };
