// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { SZ, TERR, WATER, TRAP1, TRAP2, DEN_OF, genMoves, mFrom, mTo, sideOf, rankOf, posKey, rowOf, colOf } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 400, margin: 70, slip: 0.25 },
  { name: 'Easy', depth: 2, budget: 5000, margin: 45, slip: 0.07 },
  { name: 'Medium', depth: 4, budget: 40000, margin: 14, slip: 0 },
  { name: 'Hard', depth: 6, budget: 200000, margin: 5, slip: 0 },
  { name: 'Master', depth: 9, budget: 700000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1000;
const PV = [0, 36, 20, 28, 38, 52, 72, 88, 80];                       // what each rank is worth
const DEN_DIST = new Int8Array(SZ * 3);                              // Manhattan distance of every square to each side's den
for (let s = 1; s <= 2; s++) for (let i = 0; i < SZ; i++) DEN_DIST[s * SZ + i] = Math.abs(rowOf(i) - rowOf(DEN_OF[s])) + Math.abs(colOf(i) - colOf(DEN_OF[s]));

// Static value of the position for `side` (positive = good for `side`).
function evaluate(b, side) {
  let v = 0, ratMine = false, ratTheirs = false, eleMine = false, eleTheirs = false;
  for (let i = 0; i < SZ; i++) { const p = b[i]; if (!p) continue; const s = sideOf(p), r = rankOf(p); if (r === 1) { if (s === side) ratMine = true; else ratTheirs = true; } else if (r === 8) { if (s === side) eleMine = true; else eleTheirs = true; } }
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    const s = sideOf(p), r = rankOf(p), t = TERR[i], enemy = 3 - s;
    let x = PV[r];
    if (r === 8 && (s === side ? ratTheirs : ratMine)) x -= 28;       // an elephant is worth less while an enemy rat lives
    if (r === 1 && (s === side ? eleTheirs : eleMine)) x += 34;       // and the rat worth more
    const d = DEN_DIST[enemy * SZ + i];                               // distance to the den this piece wants to reach
    x += (14 - d) * (r === 1 ? 1.5 : 3);
    if (d === 1) x += 70; else if (d === 2) x += 24;
    if ((s === 1 && t === TRAP2) || (s === 2 && t === TRAP1)) x -= 38;       // stands in a trap: weak
    if (t === WATER && r === 1) x += 6;
    v += s === side ? x : -x;
  }
  return v;
}

function makeSearch(game) {
  const b = Int8Array.from(game.board);
  const S = { b, nodes: 0, stop: false, budget: Infinity };
  // all moves for `side`, best first (den entry, then captures by the victim's worth, then advances)
  S.gen = (side) => {
    const raw = genMoves(b, side, []), den = DEN_OF[3 - side], out = new Array(raw.length);
    for (let k = 0; k < raw.length; k++) {
      const m = raw[k], from = mFrom(m), to = mTo(m), w = b[to];
      let sc = 0;
      if (to === den) sc = 100000; else if (w) sc = 1000 + PV[rankOf(w)] * 4 - PV[rankOf(b[from])];
      else sc = DEN_DIST[(3 - side) * SZ + from] - DEN_DIST[(3 - side) * SZ + to];
      out[k] = [sc, m];
    }
    out.sort((x, y) => y[0] - x[0]);
    return out;
  };
  return S;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b, opp = 3 - side;
  if (depth <= 0) return evaluate(b, side);
  const moves = S.gen(side);
  if (moves.length === 0) return -(WIN - ply);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k][1], from = mFrom(m), to = mTo(m), v = b[from], w = b[to];
    b[to] = v; b[from] = 0;
    let score;
    if (to === DEN_OF[opp]) score = WIN - ply;
    else score = -negamax(S, w && depth === 1 && ply < 8 ? 1 : depth - 1, -beta, -alpha, opp, ply + 1);      // a capture on the last ply is looked at once more
    b[from] = v; b[to] = w;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game), side = game.turn, opp = 3 - side;
  const root = S.gen(side).map(([, m]) => ({ from: mFrom(m), to: mTo(m), jump: ((m >> 12) & 1) === 1, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  for (const m of root) {                                             // discourage walking into a repeated position
    const after = game.board.slice(); after[m.to] = after[m.from]; after[m.from] = 0;
    m.rep = game.seen[posKey({ board: after, turn: opp })] || 0;
  }
  const out = (mv) => ({ from: mv.from, to: mv.to, jump: mv.jump });
  function choose() {
    // pick among the moves within `margin` of the best completed score (seeded), with a small chance of a plain slip at the lowest levels
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
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = out(choose()); return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const m = root[idx], before = S.nodes, v = S.b[m.from], w = S.b[m.to];
        S.b[m.to] = v; S.b[m.from] = 0;
        S.budget = Infinity;
        let score;
        if (m.to === DEN_OF[opp]) score = WIN;
        else score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1);
        S.b[m.from] = v; S.b[m.to] = w;
        score -= m.rep >= 2 ? 90 : m.rep === 1 ? 6 : 0;
        m.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= budget * 3) { done = true; result = out(bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0]); return { move: result }; }
      }
      return { move: undefined };
    },
  };
}

// Convenience for tests, puzzles and screenshots: run a thinker to completion.
export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
