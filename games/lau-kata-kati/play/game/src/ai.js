// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { movesFrom, POINTS, SZ, START, QUICK_GOAL } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 150, slip: 0.5, q: 0 },
  { name: 'Easy', depth: 1, budget: 300, margin: 60, slip: 0.15, q: 0 },
  { name: 'Medium', depth: 2, budget: 3000, margin: 35, slip: 0.06, q: 0 },
  { name: 'Hard', depth: 3, budget: 20000, margin: 12, slip: 0, q: 2 },
  { name: 'Master', depth: 6, budget: 400000, margin: 2, slip: 0, q: 6 },
];
// q = quiescence depth: after the last full ply the search keeps following captures so it never stops in the middle of an exchange.
const WIN = 100000, INF = 1e9, SLICE = 1000;
// One root move is searched in one go, so it is capped (in nodes) to keep a frame short on a mid phone; a depth that does not finish inside the
// cap is dropped and the last completed depth decides.
const ROOT_CAP = 60000, TOTAL_MUL = 3;
// how far toward the enemy's side a point is for side 1 (bottom): y runs 3 (own base) .. -3; a small bonus for pieces on the axis
const centre = (x) => (2.4 - Math.abs(x)) * 0.35;
const ADV = [null, POINTS.map(([x, y]) => (3 - y) * 0.6 + centre(x)), POINTS.map(([x, y]) => (y + 3) * 0.6 + centre(x))];   // [side][point]

function makeSearch(game) {
  const b = Int8Array.from(game.board), forced = game.variant === 'forced', quick = game.variant === 'quick';
  const cnt = [0, START - game.lost[1], START - game.lost[2]];
  const S = { b, cnt, nodes: 0, stop: false, budget: Infinity, forced, quick };
  // all moves for `side`, captures first (longest first)
  S.gen = (side) => {
    const out = [];
    for (let i = 0; i < SZ; i++) if (b[i] === side) for (const m of movesFrom(b, i, side)) out.push(m);
    if (forced && out.some((m) => m.caps.length)) { const c = out.filter((m) => m.caps.length); c.sort((x, y) => y.caps.length - x.caps.length); return c; }
    out.sort((x, y) => (y.caps.length - x.caps.length) || (ADV[side][y.to] - ADV[side][y.from]) - (ADV[side][x.to] - ADV[side][x.from]));
    return out;
  };
  S.won = (side) => { const opp = 3 - side; return cnt[opp] <= 0 || (quick && START - cnt[opp] >= QUICK_GOAL); };
  S.eval = (side) => {                              // from `side`'s point of view
    const opp = 3 - side;
    let v = (cnt[side] - cnt[opp]) * 100, a = 0;
    for (let i = 0; i < SZ; i++) {
      const p = b[i]; if (!p) continue;
      a += p === side ? ADV[p][i] : -ADV[p][i];
    }
    return v + a * 1.2;
  };
  return S;
}


function quiesce(S, alpha, beta, side, ply, qd) {
  S.nodes++;
  const b = S.b, opp = 3 - side;
  const stand = S.eval(side);
  if (qd >= S.q) return stand;
  if (!S.forced) { if (stand >= beta) return stand; if (stand > alpha) alpha = stand; }
  const all = S.gen(side);
  if (all.length === 0) return -(WIN - ply);
  let best = S.forced && all[0].caps.length ? -INF : stand;
  for (const m of all) {
    const n = m.caps.length; if (!n) { if (S.forced) continue; break; }
    b[m.to] = side; b[m.from] = 0;
    for (let q = 0; q < n; q++) b[m.caps[q]] = 0;
    S.cnt[opp] -= n;
    let score;
    if (S.won(side)) score = WIN - ply; else score = -quiesce(S, -beta, -alpha, opp, ply + 1, qd + 1);
    S.cnt[opp] += n;
    for (let q = 0; q < n; q++) b[m.caps[q]] = opp;
    b[m.from] = side; b[m.to] = 0;
    if (score > best) best = score; if (best > alpha) alpha = best; if (alpha >= beta) break;
    if (S.nodes > S.budget) { S.stop = true; break; }
  }
  return best === -INF ? stand : best;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b, opp = 3 - side;
  if (depth <= 0) return S.q ? quiesce(S, alpha, beta, side, ply, 0) : S.eval(side);
  const moves = S.gen(side);
  if (moves.length === 0) return -(WIN - ply);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k], n = m.caps.length;
    b[m.to] = side; b[m.from] = 0;
    for (let q = 0; q < n; q++) b[m.caps[q]] = 0;
    S.cnt[opp] -= n;
    let score;
    if (S.won(side)) score = WIN - ply;
    else score = -negamax(S, n && depth === 1 && ply < 6 ? 1 : depth - 1, -beta, -alpha, opp, ply + 1);   // a capture on the last ply is looked at once more
    S.cnt[opp] += n;
    for (let q = 0; q < n; q++) b[m.caps[q]] = opp;
    b[m.from] = side; b[m.to] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game); S.q = cfg.q || 0; const side = game.turn, opp = 3 - side, b = S.b;
  const root = S.gen(side).map((m) => ({ m, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  for (const r of root) {                                             // discourage walking into a third repetition
    const after = b.slice(); after[r.m.to] = side; after[r.m.from] = 0; for (const q of r.m.caps) after[q] = 0;
    r.rep = game.seen[Array.prototype.join.call(after, '') + opp] || 0;
  }
  const pick = (mv) => ({ from: mv.m.from, to: mv.m.to, caps: mv.m.caps.slice(), path: mv.m.path.slice() });
  function choose() {
    // pick among the moves within `margin` of the best completed score (seeded), with a small chance of a plain slip at the lowest level
    const list = bestDone || root;
    const top = Math.max(...list.map((r) => r.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)];
    const pool = list.filter((r) => r.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  return {
    progress: () => Math.min(1, used / budget),
    step() {
      if (done) return { move: result };
      let work = 0;
      while (work < SLICE) {
        if (idx >= root.length) {                                      // a depth finished: keep it, deepen
          bestDone = root.map((r) => ({ ...r }));
          root.sort((x, y) => y.score - x.score);
          const top = root[0].score;
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = pick(choose()); return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const r = root[idx], m = r.m, n = m.caps.length, before = S.nodes;
        b[m.to] = side; b[m.from] = 0;
        for (let q = 0; q < n; q++) b[m.caps[q]] = 0;
        S.cnt[opp] -= n; S.stop = false; S.budget = before + Math.max(1000, Math.min(ROOT_CAP, budget * TOTAL_MUL - used));
        let score;
        if (S.won(side)) score = WIN;
        else score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1);
        S.cnt[opp] += n;
        for (let q = 0; q < n; q++) b[m.caps[q]] = opp;
        b[m.from] = side; b[m.to] = 0;
        if (S.stop && bestDone) { done = true; result = pick(choose()); return { move: result }; }   // this depth would not finish within the cap
        score -= r.rep >= 2 ? 80 : 0;
        r.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= budget * TOTAL_MUL) { done = true; result = pick(bestDone ? choose() : root.slice().sort((x, y) => y.score - x.score)[0]); return { move: result }; }
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
