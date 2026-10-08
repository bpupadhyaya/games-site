// The computer player: iterative-deepening alpha-beta (negamax) over the real rules, cut into small slices so a frame never stalls.
// Evaluation = square values (corners great, the squares beside an empty corner bad) + mobility + stable-ish edges + disc count late in the game;
// near the end of the game it solves the position exactly. Deterministic: budgets are counted in search nodes (never a clock) and the only
// randomness is the seeded env.rng, used to choose among near-equal moves so the computer does not play the same game twice.
// `step()` does a little work and returns { move } when it has decided ({ move: undefined } = keep calling).
import { raysFor, flipsAt, VARIANTS } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 400, slip: 0.3, exact: 0 },
  { name: 'Easy', depth: 2, budget: 3000, margin: 120, slip: 0.08, exact: 0 },
  { name: 'Medium', depth: 4, budget: 20000, margin: 40, slip: 0, exact: 7 },
  { name: 'Hard', depth: 6, budget: 90000, margin: 12, slip: 0, exact: 9 },
  { name: 'Master', depth: 7, budget: 260000, margin: 3, slip: 0, exact: 11 },
];
const WIN = 1e6, INF = 1e9, SLICE = 4000;

// Square values for an 8 by 8 board (one quarter, mirrored), and for 6 by 6.
const W8 = [[120, -25, 12, 6], [-25, -50, -3, -3], [12, -3, 4, 1], [6, -3, 1, 0]];
const W6 = [[120, -25, 10], [-25, -50, -2], [10, -2, 2]];
const wCache = {};
function weights(n) {
  if (wCache[n]) return wCache[n];
  const q = n === 8 ? W8 : W6, w = new Int16Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) w[r * n + c] = q[Math.min(r, n - 1 - r)][Math.min(c, n - 1 - c)];
  return (wCache[n] = w);
}

function makeSearch(game) {
  const n = game.n, b = Int8Array.from(game.board), rays = raysFor(n), W = weights(n), reverse = VARIANTS[game.variant].reverse, size = n * n;
  const corners = [0, n - 1, n * (n - 1), size - 1];
  const S = { b, n, nodes: 0, stop: false, budget: Infinity, reverse };
  const place = (i, side) => {                                     // returns the flipped squares or null
    const f = flipsAt(b, n, i, side);
    if (!f.length) return null;
    b[i] = side; for (let k = 0; k < f.length; k++) b[f[k]] = side;
    return f;
  };
  const undo = (i, side, f) => { b[i] = 0; const o = 3 - side; for (let k = 0; k < f.length; k++) b[f[k]] = o; };
  S.place = place; S.undo = undo;
  S.moves = (side) => {                                            // legal squares, best-looking first
    const out = [];
    for (let i = 0; i < size; i++) if (b[i] === 0 && flipsAt(b, n, i, side).length) out.push(i);
    out.sort(reverse ? (x, y) => W[x] - W[y] : (x, y) => W[y] - W[x]);
    return out;
  };
  const mob = (side) => { let c = 0; for (let i = 0; i < size; i++) if (b[i] === 0 && flipsAt(b, n, i, side).length) c++; return c; };
  S.empties = () => { let c = 0; for (let i = 0; i < size; i++) if (b[i] === 0) c++; return c; };
  S.final = (side) => {                                            // exact result for `side`
    let m = 0, o = 0; for (let i = 0; i < size; i++) { if (b[i] === side) m++; else if (b[i]) o++; }
    const d = reverse ? o - m : m - o;
    return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
  };
  S.eval = (side) => {
    const opp = 3 - side; let m = 0, o = 0, pos = 0, empt = 0;
    for (let i = 0; i < size; i++) { const p = b[i]; if (p === side) { m++; pos += W[i]; } else if (p === opp) { o++; pos -= W[i]; } else empt++; }
    // a corner changes the squares beside it: once the corner is taken they are no longer a liability
    for (let k = 0; k < 4; k++) {
      const cs = corners[k];
      if (b[cs] !== 0) {
        const r = cs < size / 2 ? 1 : -1, c = cs % n === 0 ? 1 : -1, near = [cs + c, cs + r * n, cs + r * n + c];
        for (const q of near) { if (b[q] === side) pos += -W[q] + 8; else if (b[q] === opp) pos -= -W[q] + 8; }
      }
    }
    const mm = mob(side), mo = mob(opp), late = 1 - empt / size;
    const mobility = mm + mo === 0 ? 0 : 100 * (mm - mo) / (mm + mo + 2);
    let v;
    if (reverse) v = (mm - mo) * 9 + (o - m) * (2 + 12 * late * late) - pos * 0.15;
    else v = pos * 1.0 + mobility * 1.6 + (m - o) * (late > 0.7 ? 10 * late : 0.5);
    return v;
  };
  return S;
}

function negamax(S, depth, alpha, beta, side, ply, passed) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b;
  const moves = S.moves(side);
  if (moves.length === 0) {
    if (passed) return S.final(side);                              // neither side can move: the game is over
    return -negamax(S, depth, -beta, -alpha, 3 - side, ply + 1, true);
  }
  if (depth <= 0) return S.eval(side);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const f = S.place(moves[k], side);
    const score = -negamax(S, depth - 1, -beta, -alpha, 3 - side, ply + 1, false);
    S.undo(moves[k], side, f);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game), side = game.turn;
  const first = S.moves(side);
  if (first.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const root = first.map((to) => ({ to, score: 0 }));
  let exact = S.empties() <= cfg.exact;
  let maxDepth = exact ? 99 : cfg.depth;
  const budget = cfg.budget;
  let depth = exact ? 99 : 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  function choose() {
    const list = bestDone || root;
    const top = Math.max(...list.map((m) => m.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)];
    const pool = list.filter((m) => m.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  return {
    progress: () => Math.min(1, used / budget),
    step() {
      if (done) return { move: result };
      if (root.length === 1) { done = true; result = { to: root[0].to }; return { move: result }; }
      let work = 0;
      while (work < SLICE) {
        if (idx >= root.length) {                                    // a depth finished: keep it, deepen
          bestDone = root.map((m) => ({ ...m }));
          root.sort((a, c) => c.score - a.score);
          if (depth >= maxDepth || used >= budget || root[0].score > WIN - 100) { done = true; const mv = choose(); result = { to: mv.to }; return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const m = root[idx], before = S.nodes;
        const f = S.place(m.to, side);
        S.budget = exact ? before + budget * 4 : Infinity; S.stop = false;
        let score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), 3 - side, 1, false);
        S.undo(m.to, side, f);
        if (S.stop) {                                           // the exact solve is too big: fall back to the ordinary search
          exact = false; maxDepth = cfg.depth; depth = 1; idx = 0; alpha = -INF; S.stop = false; for (const r of root) r.score = 0; continue;
        }
        m.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= budget * 4) { done = true; const mv = bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0]; result = { to: mv.to }; return { move: result }; }
      }
      return { move: undefined };
    },
  };
}

// Convenience for tests and screenshots: run a thinker to completion.
export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
