// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { generate, sideOf, isKing, rowOf, colOf, promoRow, fwd, SZ } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 90, slip: 0.25 },
  { name: 'Easy', depth: 2, budget: 3000, margin: 45, slip: 0.08 },
  { name: 'Medium', depth: 4, budget: 20000, margin: 15, slip: 0 },
  { name: 'Hard', depth: 6, budget: 90000, margin: 5, slip: 0 },
  { name: 'Master', depth: 9, budget: 260000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 1500, MAN = 100, KING = 330;
const ROOT_CAP = 5000;   // nodes one root move may cost: a single step() never stalls a frame (weak phones); deeper levels simply stop at the last completed depth

// Static evaluation from `side`'s point of view: material, how far the men have marched, and where the kings stand.
function evaluate(b, side) {
  let v = 0;
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    const s = sideOf(p), r = rowOf(i), c = colOf(i);
    let x;
    if (isKing(p)) {
      const cen = 3 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)) + 0.5;
      x = KING + cen * 4;
    } else {
      const adv = s === 1 ? 6 - r : r - 1;                          // 0 on the home rows .. 6 on the crowning row
      x = MAN + adv * 5 + (adv >= 5 ? 14 : 0) + (c > 0 && c < 7 ? 2 : 0);
    }
    v += s === side ? x : -x;
  }
  return v;
}

// doMove / undoMove work in place on a plain array board and return what is needed to take the move back.
function doMove(b, m) {
  const p = b[m.from], side = sideOf(p), np = !isKing(p) && rowOf(m.to) === promoRow(side) ? side + 2 : p;
  const saved = m.caps.map((q) => b[q]);
  b[m.from] = 0; for (const q of m.caps) b[q] = 0; b[m.to] = np;
  return { p, saved };
}
function undoMove(b, m, u) {
  b[m.to] = 0; for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = u.saved[k]; b[m.from] = u.p;
}
const orderKey = (b, m, side) => {
  const p = b[m.from]; if (m.caps.length) return 1000 + m.caps.length * 10;
  const r = rowOf(m.to), adv = isKing(p) ? 0 : (side === 1 ? 7 - r : r);
  return adv + (isKing(p) ? 0 : (r === promoRow(side) ? 50 : 0));
};
function ordered(b, side, variant) {
  const ms = generate(b, side, variant);
  if (ms.length > 1) { const k = new Map(); for (const m of ms) k.set(m, orderKey(b, m, side)); ms.sort((x, y) => k.get(y) - k.get(x)); }
  return ms;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b, moves = ordered(b, side, S.variant);
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0 && (moves[0].caps.length === 0 || ply > 18)) return evaluate(b, side);          // quiet position: stop; forced captures are played out
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k], u = doMove(b, m);
    const score = -negamax(S, depth - 1, -beta, -alpha, 3 - side, ply + 1);
    undoMove(b, m, u);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], side = game.turn, opp = 3 - side;
  const S = { b: game.board.slice(), variant: game.variant, nodes: 0, stop: false, budget: Infinity };
  const root = ordered(S.b, side, S.variant).map((m) => ({ m, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  if (root.length === 1) return { step: () => ({ move: root[0].m }), progress: () => 1 };       // a forced move needs no thought
  for (const r of root) {                                              // discourage walking into a third repetition
    const u = doMove(S.b, r.m); r.rep = game.seen[S.b.join('') + opp] || 0; undoMove(S.b, r.m, u);
  }
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null;
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
        const r = root[idx], before = S.nodes, u = doMove(S.b, r.m);
        S.budget = S.nodes + ROOT_CAP; S.stop = false;
        const score = -negamax(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1) - (r.rep >= 2 ? 80 : 0);
        undoMove(S.b, r.m, u);
        if (S.stop) {                                                  // this depth is too costly for one slice: play the last completed depth
          done = true; result = bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0].m; return { move: result };
        }
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
