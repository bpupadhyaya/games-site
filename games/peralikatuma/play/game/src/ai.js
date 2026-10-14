// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { generate, sideOf, isStar, crownRow, rowOf, colOf, SZ, VARIANTS } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 90, slip: 0.25 },
  { name: 'Easy', depth: 2, budget: 3000, margin: 45, slip: 0.07 },
  { name: 'Medium', depth: 4, budget: 24000, margin: 15, slip: 0 },
  { name: 'Hard', depth: 6, budget: 110000, margin: 5, slip: 0 },
  { name: 'Master', depth: 9, budget: 420000, margin: 2, slip: 0 },
];
const WIN = 100000, INF = 1e9, SLICE = 700;
// The most nodes one root move may search before the last finished depth is used instead.
export const TUNE = { rootCap: 30000 };
const MAN = 100, STAR = 330;

// Static value for `side` (from its own point of view): material, how far men have come, the centre, a guard on the home rows, and Stars.
const adv = (side, i) => (side === 1 ? 8 - rowOf(i) : rowOf(i));
function evaluate(b, side) {
  let v = 0;
  for (let i = 0; i < SZ; i++) {
    const c = b[i]; if (!c) continue;
    const s = sideOf(c), r = rowOf(i), k = colOf(i);
    const centre = 4 - Math.max(Math.abs(r - 4), Math.abs(k - 4)) * 0.5;
    let x;
    if (isStar(c)) x = STAR + centre * 4;
    else {
      const a = adv(s, i);
      x = MAN + a * 5 + centre * 2 + (a === 0 ? 14 : 0);      // an unmoved back-row man keeps the enemy from crowning
      if (a >= 6) x += 18;                                    // close to crowning
    }
    v += s === side ? x : -x;
  }
  return v;
}

// make / unmake on the search board; the undo record is small and local
function make(b, m) {
  const piece = b[m.from], n = m.caps.length, saved = n ? new Array(n) : null;
  for (let q = 0; q < n; q++) { saved[q] = b[m.caps[q]]; b[m.caps[q]] = 0; }
  b[m.from] = 0;
  const side = sideOf(piece), promo = !isStar(piece) && crownRow(side, m.to);
  b[m.to] = promo ? piece + 2 : piece;
  return { piece, saved, promo };
}
function unmake(b, m, u) {
  b[m.to] = 0; b[m.from] = u.piece;
  for (let q = 0; q < m.caps.length; q++) b[m.caps[q]] = u.saved[q];
}
// order: captures (longest first), crowning, then forward and central
function ordered(b, side, flying) {
  const ms = generate(b, side, flying);
  for (const m of ms) {
    const piece = b[m.from], promo = !isStar(piece) && crownRow(side, m.to);
    m.key = m.caps.length * 1000 + (promo ? 400 : 0) + (isStar(piece) ? 0 : 20 + adv(side, m.to) * 3) + (8 - Math.abs(rowOf(m.to) - 4) - Math.abs(colOf(m.to) - 4));
  }
  ms.sort((x, y) => y.key - x.key);
  return ms;
}

// Alpha-beta as an explicit stack, so one root move's search can be paused after any number of nodes and resumed on the next frame
// (identical result and node order to the plain recursive search; only the yielding is new).
function enter(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const b = S.b, moves = ordered(b, side, S.flying);
  if (moves.length === 0) return -(WIN - ply);
  if (depth <= 0) {
    if (moves[0].caps.length && ply < S.maxPly) depth = 1;   // a capture is compulsory next: do not stop in the middle of an exchange
    else return evaluate(b, side);
  }
  S.stack.push({ moves, k: 0, depth, alpha, beta, best: -INF, side, ply, m: null, u: null });
  return undefined;
}
function beginSearch(S, depth, alpha, beta, side, ply) {
  S.stack = []; S.ret = enter(S, depth, alpha, beta, side, ply);
}
// Runs until the search finishes ({ done: true, val }) or `limit` more nodes were spent ({ done: false }).
function advance(S, limit) {
  const stop = S.nodes + limit, st = S.stack, b = S.b;
  let ret = S.ret;
  for (;;) {
    if (ret === undefined) {
      if (S.nodes >= stop) return { done: false };
      const f = st[st.length - 1];
      if (f.k >= f.moves.length) { ret = f.best; st.pop(); }
      else {
        f.m = f.moves[f.k++]; f.u = make(b, f.m);
        ret = enter(S, f.depth - 1, -f.beta, -f.alpha, 3 - f.side, f.ply + 1);
        continue;
      }
    }
    if (st.length === 0) { S.ret = undefined; return { done: true, val: ret }; }
    const f = st[st.length - 1];
    unmake(b, f.m, f.u);
    const score = -ret;
    if (score > f.best) f.best = score;
    if (f.best > f.alpha) f.alpha = f.best;
    if (f.alpha >= f.beta || S.stop) { ret = f.best; st.pop(); continue; }
    ret = undefined;
  }
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const flying = VARIANTS[game.variant].flying, side = game.turn, opp = 3 - side;
  const S = { b: Int8Array.from(game.board), nodes: 0, stop: false, budget: Infinity, flying, maxPly: 14 };
  const root = ordered(S.b, side, flying).map((m) => ({ from: m.from, to: m.to, path: m.path, caps: m.caps, score: 0, rep: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = cfg.budget;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null, cur = null;
  for (const m of root) {                                             // discourage walking into a third repetition
    const u = make(S.b, m), key = Array.prototype.join.call(S.b, '') + opp;
    unmake(S.b, m, u);
    m.rep = game.seen[key] || 0;
  }
  const pick = (mv) => ({ from: mv.from, to: mv.to, path: mv.path, caps: mv.caps });
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
      if (root.length === 1) { done = true; result = pick(root[0]); return { move: result }; }   // a forced move needs no thought
      let work = 0;
      while (work < SLICE) {
        if (!cur) {
          if (idx >= root.length) {                                    // a depth finished: keep it, deepen
            bestDone = root.map((m) => ({ ...m }));
            root.sort((a, c) => c.score - a.score);
            const top = root[0].score;
            if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; result = pick(choose()); return { move: result }; }
            depth++; idx = 0; alpha = -INF; continue;
          }
          const m = root[idx];
          cur = { m, u: make(S.b, m), before: S.nodes };
          S.budget = S.nodes + Math.min(TUNE.rootCap, Math.max(1500, cfg.budget * 0.5)); S.stop = false;   // one root move can never run away
          beginSearch(S, depth - 1, -INF, -(alpha - cfg.margin - 1), opp, 1);
        }
        const n0 = S.nodes, r = advance(S, SLICE - work);
        work += S.nodes - n0 + 1;
        if (!r.done) break;
        const { m, u, before } = cur; cur = null;
        unmake(S.b, m, u);
        let score = -r.val;
        if (S.stop && bestDone) { done = true; result = pick(choose()); return { move: result }; }   // this depth did not finish: use the last full one
        score -= m.rep >= 2 ? 80 : 0;
        m.score = score; if (score > alpha) alpha = score;
        idx++; used += S.nodes - before + 1;
        if (used >= budget * 3) { done = true; result = pick(bestDone ? choose() : root.slice().sort((a, c) => c.score - a.score)[0]); return { move: result }; }
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
