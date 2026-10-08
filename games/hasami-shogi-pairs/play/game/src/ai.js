// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { destinations, capturesAt, hasFive, START, SZ } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 400, margin: 70, slip: 0.22 },
  { name: 'Easy', depth: 2, budget: 4000, margin: 40, slip: 0.06 },
  { name: 'Medium', depth: 3, budget: 30000, margin: 14, slip: 0 },
  { name: 'Hard', depth: 5, budget: 150000, margin: 5, slip: 0 },
  { name: 'Master', depth: 8, budget: 600000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1000;
const buf = new Int16Array(40);

// ---- the search position ---------------------------------------------------------------------------------------------------
function makeSearch(game) {
  const b = Int8Array.from(game.board), variant = game.variant, jump = variant === 'dai', start = START(variant);
  const cnt = [0, start - game.lost[1], start - game.lost[2]];
  const S = { b, cnt, nodes: 0, stop: false, budget: Infinity, variant, jump, start };
  const tmp = [];
  // all moves for `side`, best first (captures, then toward the middle)
  S.gen = (side) => {
    const out = [];
    for (let i = 0; i < SZ; i++) {
      if (b[i] !== side) continue;
      tmp.length = 0; destinations(b, i, jump, tmp);
      for (let k = 0; k < tmp.length; k++) {
        const to = tmp[k];
        b[to] = side; b[i] = 0;
        const n = capturesAt(b, to, side);
        b[i] = side; b[to] = 0;
        const r = (to / 9) | 0, c = to % 9, mid = 8 - Math.abs(r - 4) - Math.abs(c - 4);
        out.push([n * 1000 + mid, i, to]);
      }
    }
    out.sort((x, y) => y[0] - x[0]);
    return out;
  };
  // winner after `side` has moved (counts already updated)
  S.won = (side) => {
    const opp = 3 - side;
    if (variant === 'classic') return cnt[opp] <= 1;
    if (variant === 'quick') return start - cnt[opp] >= 5;
    return cnt[opp] < 5 || hasFive(b, side);
  };
  S.eval = (side) => {                              // from `side`'s point of view
    const opp = 3 - side;
    let v = (cnt[side] - cnt[opp]) * (variant === 'dai' ? 45 : 100);
    if (variant === 'dai') v += lineScore(b, side) - lineScore(b, opp);
    else {
      let a = 0;
      for (let i = 0; i < SZ; i++) { const p = b[i]; if (p) { const adv = p === 1 ? 8 - ((i / 9) | 0) : (i / 9) | 0; a += p === side ? adv : -adv; } }
      v += a * 2;
    }
    return v;
  };
  return S;
}

// Dai: how close is each side to an unbroken five outside its home ranks? Windows of five with no enemy piece, rewarded by how full they are.
const WINDOW = [0, 0, 3, 9, 40, 0];
function lineScore(b, side) {
  const opp = 3 - side, r0 = side === 1 ? 0 : 2, r1 = side === 1 ? 6 : 8;
  let s = 0;
  for (let r = r0; r <= r1; r++) for (let c0 = 0; c0 <= 4; c0++) {
    let own = 0, bad = false;
    for (let k = 0; k < 5; k++) { const p = b[r * 9 + c0 + k]; if (p === side) own++; else if (p === opp) { bad = true; break; } }
    if (!bad) s += WINDOW[own];
  }
  for (let c = 0; c < 9; c++) for (let rs = r0; rs + 4 <= r1; rs++) {
    let own = 0, bad = false;
    for (let k = 0; k < 5; k++) { const p = b[(rs + k) * 9 + c]; if (p === side) own++; else if (p === opp) { bad = true; break; } }
    if (!bad) s += WINDOW[own];
  }
  return s;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b, opp = 3 - side;
  if (depth <= 0) return S.eval(side);
  const moves = S.gen(side);
  if (moves.length === 0) return -(WIN - ply);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const from = moves[k][1], to = moves[k][2];
    b[to] = side; b[from] = 0;
    const n = capturesAt(b, to, side);
    let saved = null;
    if (n) { saved = Array.from(buf.subarray(0, n)); for (let q = 0; q < n; q++) b[saved[q]] = 0; S.cnt[opp] -= n; }
    let score;
    if (S.won(side)) score = WIN - ply;
    else score = -negamax(S, n && depth === 1 && ply < 6 ? 1 : depth - 1, -beta, -alpha, opp, ply + 1);   // a capture on the last ply is looked at once more
    if (n) { for (let q = 0; q < n; q++) b[saved[q]] = opp; S.cnt[opp] += n; }
    b[from] = side; b[to] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game), side = game.turn, opp = 3 - side;
  const root = S.gen(side).map((m) => ({ from: m[1], to: m[2], score: 0, rep: 0, caps: Math.floor(m[0] / 1000) }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = S.variant === 'dai' ? cfg.budget * 0.6 : cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, best = root[0], used = 0, bestDone = null;
  for (const m of root) {                                             // discourage walking into a third repetition
    S.b[m.to] = side; S.b[m.from] = 0;
    const n = capturesAt(S.b, m.to, side), after = S.b.slice(); for (let q = 0; q < n; q++) after[buf[q]] = 0;
    S.b[m.from] = side; S.b[m.to] = 0;
    m.rep = game.seen[Array.prototype.join.call(after, '') + opp] || 0;
  }
  function choose() {
    // pick among the moves within `margin` of the best completed score (seeded), with a small chance of a plain slip at the lowest level
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
      let work = 0;
      while (work < SLICE) {
        if (idx >= root.length) {                                      // a depth finished: keep it, deepen
          bestDone = root.map((m) => ({ ...m }));
          root.sort((a, c) => c.score - a.score);
          const top = root[0].score;
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; const mv = choose(); result = { from: mv.from, to: mv.to }; return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const m = root[idx], before = S.nodes;
        S.b[m.to] = side; S.b[m.from] = 0;
        const n = capturesAt(S.b, m.to, side);
        let saved = null;
        if (n) { saved = Array.from(buf.subarray(0, n)); for (let q = 0; q < n; q++) S.b[saved[q]] = 0; S.cnt[opp] -= n; }
        S.budget = Infinity;
        let score;
        if (S.won(side)) score = WIN;
        else score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1);
        if (n) { for (let q = 0; q < n; q++) S.b[saved[q]] = opp; S.cnt[opp] += n; }
        S.b[m.from] = side; S.b[m.to] = 0;
        score -= m.rep >= 2 ? 80 : 0;
        m.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= budget * 3) { done = true; const mv = (bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0]); result = { from: mv.from, to: mv.to }; return { move: result }; }
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
