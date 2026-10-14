// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { movesOn } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 120, slip: 0.25 },
  { name: 'Easy', depth: 2, budget: 3000, margin: 60, slip: 0.08 },
  { name: 'Medium', depth: 4, budget: 25000, margin: 20, slip: 0 },
  { name: 'Hard', depth: 8, budget: 150000, margin: 6, slip: 0 },
  { name: 'Master', depth: 16, budget: 900000, margin: 0, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 700;

function makeSearch(game) {
  const W = game.W, b = Int8Array.from(game.board), cnt = [0, 0, 0];
  for (const p of b) if (p) cnt[p]++;
  const S = { b, W, cnt, nodes: 0, stop: false, budget: Infinity };
  S.gen = (side) => {
    const moves = movesOn(b, W, side);
    for (const m of moves) { const r = Math.floor(m.to / W), c = m.to % W, mid = (W - 1) - Math.abs(r - (W - 1) / 2) - Math.abs(c - (W - 1) / 2); m.o = m.caps.length * 1000 + mid; }
    moves.sort((x, y) => y.o - x.o);
    return moves;
  };
  // from `side`'s point of view: material first, then stones that threaten a capture and stones that stand safe
  S.eval = (side) => {
    const opp = 3 - side;
    let v = (cnt[side] - cnt[opp]) * 100;
    let adv = 0;
    for (let i = 0; i < b.length; i++) { const p = b[i]; if (!p) continue; const r = Math.floor(i / W), a = p === 1 ? (W - 1 - r) : r; adv += p === side ? a : -a; }
    return v + adv * 2;
  };
  return S;
}

// Resumable negamax: the same alpha-beta as a plain recursive search, but on an explicit stack so it can pause every few hundred nodes
// and continue on the next frame. Node counting, the budget stop and every cutoff are identical to the recursive form, so the move chosen
// does not depend on how the work is sliced.
function newSearch(S, depth, alpha, beta, side, ply) {
  return { S, stack: [], n: 0, mode: 0, ret: 0, done: false, a: [depth, alpha, beta, side, ply] };   // mode 0 enter, 1 next move, 2 return
}

// Runs until the search finishes or about `limit` nodes were spent. Returns true when finished (value in st.ret).
function resume(st, limit) {
  const S = st.S, b = S.b, stack = st.stack, stop0 = S.nodes + limit;
  let mode = st.mode, ret = st.ret, [depth, alpha, beta, side, ply] = st.a;
  for (;;) {
    if (mode === 0) {
      if (S.nodes >= stop0) { st.mode = 0; st.ret = ret; st.a = [depth, alpha, beta, side, ply]; return false; }
      S.nodes++;
      if (S.nodes > S.budget) S.stop = true;
      if (S.cnt[3 - side] === 0) { ret = WIN - ply; mode = 2; }
      else if (depth <= 0) { ret = S.eval(side); mode = 2; }
      else {
        const moves = S.gen(side);
        if (moves.length === 0) { ret = -(WIN - ply); mode = 2; }
        else { stack.push({ depth, alpha, beta, side, ply, moves, k: 0, best: -INF, m: null }); mode = 1; }
      }
    } else if (mode === 1) {
      const f = stack[stack.length - 1], m = f.moves[f.k], opp = 3 - f.side;
      f.m = m;
      b[m.from] = 0; b[m.to] = f.side; for (const c of m.caps) b[c] = 0; S.cnt[opp] -= m.caps.length;
      depth = m.caps.length && f.depth === 1 && f.ply < 8 ? 1 : f.depth - 1;          // look once more after a capture on the last ply
      alpha = -f.beta; beta = -f.alpha; side = opp; ply = f.ply + 1; mode = 0;
    } else {
      if (stack.length === 0) { st.mode = 2; st.ret = ret; st.done = true; return true; }
      const f = stack[stack.length - 1], m = f.m, opp = 3 - f.side;
      const score = -ret;
      for (const c of m.caps) b[c] = opp; S.cnt[opp] += m.caps.length; b[m.to] = 0; b[m.from] = f.side;
      if (score > f.best) f.best = score;
      if (f.best > f.alpha) f.alpha = f.best;
      f.k++;
      if (f.alpha >= f.beta || S.stop || f.k >= f.moves.length) { stack.pop(); ret = f.best; mode = 2; }
      else mode = 1;
    }
  }
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game), side = game.turn, opp = 3 - side;
  const root = S.gen(side).map((m) => ({ ...m, score: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = cfg.budget * (game.W >= 7 ? 0.6 : 1);
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null, cur = null, before = 0;
  const out = (m) => ({ from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice() });
  function choose() {
    const list = bestDone || root;
    const top = Math.max(...list.map((m) => m.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)];
    const pool = list.filter((m) => m.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  return {
    progress: () => Math.min(1, (used + (cur ? S.nodes - before : 0)) / budget),
    step() {
      if (done) return { move: result };
      let work = 0;
      while (work < SLICE) {
        if (!cur) {
          if (idx >= root.length) {                                    // a depth finished: keep it, deepen
            bestDone = root.map((m) => ({ ...m }));
            root.sort((a, c) => c.score - a.score);
            const top = root[0].score;
            if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = out(choose()); return { move: result }; }
            depth++; idx = 0; alpha = -INF; continue;
          }
          const m = root[idx];
          before = S.nodes;
          S.b[m.from] = 0; S.b[m.to] = side; for (const c of m.caps) S.b[c] = 0; S.cnt[opp] -= m.caps.length;
          S.budget = before + Math.min(50000, Math.max(3000, budget * 3 - used)); S.stop = false;     // same cap as ever, but spread over frames
          cur = S.cnt[opp] === 0 ? { done: true, ret: -WIN } : newSearch(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1);
        }
        const n0 = S.nodes;
        if (!cur.done && !resume(cur, SLICE - work)) { work += S.nodes - n0; break; }
        work += S.nodes - n0 + 1;
        const m = root[idx], score = -cur.ret;
        cur = null;
        for (const c of m.caps) S.b[c] = opp; S.cnt[opp] += m.caps.length; S.b[m.to] = 0; S.b[m.from] = side;
        if (S.stop && bestDone) { S.stop = false; done = true; result = out(choose()); return { move: result }; }   // out of budget mid-depth: keep the last full depth
        m.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; used += cost + 1;
        if (used >= budget * 3) { done = true; const mv = bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0]; result = out(mv); return { move: result }; }
      }
      return { move: undefined };
    },
  };
}

export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
