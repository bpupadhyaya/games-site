// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock); the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when decided.
import { genMoves, variantOf } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 200, child: 300, margin: 400, slip: 0.3 },
  { name: 'Easy', depth: 2, budget: 2000, child: 1500, margin: 60, slip: 0.1 },
  { name: 'Medium', depth: 4, budget: 20000, child: 5000, margin: 12, slip: 0 },
  { name: 'Hard', depth: 8, budget: 120000, child: 12000, margin: 4, slip: 0 },
  { name: 'Master', depth: 14, budget: 400000, child: 30000, margin: 1, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1200;

// Static value from `side`'s view: open lines, and room to move.
function evaluate(S, side) {
  const V = S.V, b = S.b; let v = 0;
  for (const t of V.triples) {
    let a = 0, o = 0; for (const p of t) { if (b[p] === side) a++; else if (b[p]) o++; }
    if (a && !o) v += a === 2 ? 28 : 4; else if (o && !a) v -= o === 2 ? 28 : 4;
  }
  let mine = 0, theirs = 0;
  for (let i = 0; i < V.n; i++) { if (!b[i]) continue; const free = V.adj[i].filter((j) => !b[j]).length; if (b[i] === side) mine += free; else theirs += free; }
  return v + (mine - theirs) * 3;
}
function hasLine(b, side, V) { for (const t of V.triples) if (b[t[0]] === side && b[t[1]] === side && b[t[2]] === side) return true; return false; }

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++; if (S.nodes > S.budget) S.stop = true;
  const moves = genMoves(S.b, side, S.placed, S.V);
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0 || (S.stop && depth <= 1)) return evaluate(S, side);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    if (m.kind === 'drop') { S.b[m.to] = side; S.placed[side]++; } else { S.b[m.from] = 0; S.b[m.to] = side; }
    const score = hasLine(S.b, side, S.V) ? WIN - ply : -negamax(S, depth - 1, -beta, -alpha, 3 - side, ply + 1);
    if (m.kind === 'drop') { S.b[m.to] = 0; S.placed[side]--; } else { S.b[m.to] = 0; S.b[m.from] = side; }
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || (S.stop && k >= 1)) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], V = variantOf(game.variant), side = game.turn;
  const S = { V, b: Int8Array.from(game.board), placed: game.placed.slice(), nodes: 0, stop: false, budget: Infinity };
  const root = genMoves(S.b, side, S.placed, V).map((m) => ({ m, score: 0, rep: 0, win: false }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  if (root.length === 1) return { step: () => ({ move: root[0].m }), progress: () => 1 };
  const apply = (m) => { if (m.kind === 'drop') { S.b[m.to] = side; S.placed[side]++; } else { S.b[m.from] = 0; S.b[m.to] = side; } };
  const undo = (m) => { if (m.kind === 'drop') { S.b[m.to] = 0; S.placed[side]--; } else { S.b[m.to] = 0; S.b[m.from] = side; } };
  for (const r of root) {                                          // note repeats and immediate wins
    apply(r.m);
    const key = Array.prototype.join.call(S.b, '') + '|' + (3 - side) + S.placed[1] + S.placed[2];
    r.rep = game.seen[key] || 0; r.win = hasLine(S.b, side, V); undo(r.m);
  }
  const winning = root.find((r) => r.win);
  if (winning && level >= 1) return { step: () => ({ move: winning.m }), progress: () => 1 };   // from Easy up, a line in one is always taken
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
  function choose() {
    const list = bestDone || root, top = Math.max(...list.map((r) => r.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)].m;
    const pool = list.filter((r) => r.score >= top - cfg.margin);
    return pool[rng.int(pool.length)].m;
  }
  return {
    progress: () => Math.min(1, used / cfg.budget),
    step() {
      if (done) return { move: result };
      let work = 0;
      while (work < SLICE) {
        if (idx >= root.length) {
          bestDone = root.map((r) => ({ ...r }));
          root.sort((a, c) => c.score - a.score);
          if (depth >= cfg.depth || used >= cfg.budget || root[0].score > WIN - 200) { done = true; result = choose(); return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const r = root[idx], before = S.nodes;
        apply(r.m); S.budget = S.nodes + cfg.child; S.stop = false;
        const score = (r.win ? WIN : -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), 3 - side, 1)) - (r.rep >= 2 ? 80 : 0);
        undo(r.m);
        if (S.stop && bestDone) { done = true; result = choose(); return { move: result }; }
        r.score = score; if (score > alpha) alpha = score;
        idx++; const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= cfg.budget * 3) { done = true; result = bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0].m; return { move: result }; }
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
