// The opponents. One alpha-beta search over the engine's own moves (a capture chain is several plies of the same side, and
// capturing is compulsory so most positions have very few moves). Five levels differ in depth, node budget and a little
// deliberate carelessness at the lower levels. Searching is counted in nodes (never time), so the same position always gives
// the same answer for the same rng stream, and a search is a generator that yields every few thousand nodes (a few milliseconds) so the screen never stalls.
import { NN, rc, LINES, legalMoves, applyMove, countOf, other } from './rules.js';

export const LEVELS = [
  { id: 'novice', depth: 0, cap: 0, flaw: 0 },
  { id: 'casual', depth: 2, cap: 3000, flaw: 0.25 },
  { id: 'skilled', depth: 3, cap: 6000, flaw: 0.08 },
  { id: 'expert', depth: 5, cap: 15000, flaw: 0.03 },
  { id: 'master', depth: 10, cap: 250000, flaw: 0 },
];
export const levelOf = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

// A small deterministic generator for Think and tests: the same position always gives the same advice.
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}
export function seedOf(st) {
  let h = 2166136261;
  for (let i = 0; i < NN; i++) h = Math.imul(h ^ (st.cells[i] + 1), 16777619);
  h = Math.imul(h ^ (st.turn * 7 + st.tn), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------------------------------------------- evaluation
// Score for `me` (higher is better): material first, then pieces advanced, a home row that is still guarded, and freedom to move.
const ADV = [];
for (let who = 1; who <= 2; who++) {
  const a = [];
  for (let i = 0; i < NN; i++) { const [r] = rc(i); a.push(who === 1 ? 4 - r : r); }
  ADV.push(a);
}
function side(cells, who) {
  let n = 0, adv = 0, home = 0;
  const homeRow = who === 1 ? 4 : 0;
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== who) continue;
    n++; adv += ADV[who - 1][i];
    if (rc(i)[0] === homeRow) home++;
  }
  return { n, adv, home };
}
export const EVAL = { adv: 2, home: 8, hub: 6, mob: 4 };
export function evaluate(st, me) {
  const a = side(st.cells, me), b = side(st.cells, other(me));
  let hub = 0;
  for (let i = 0; i < NN; i++) { const c = st.cells[i]; if (c && HUB[i]) hub += c === me ? 1 : -1; }
  let v = (a.n - b.n) * 100 + (a.adv - b.adv) * EVAL.adv + (a.home - b.home) * EVAL.home + hub * EVAL.hub;
  if (EVAL.mob) v += EVAL.mob * (mobility(st.cells, me) - mobility(st.cells, other(me)));
  return v;
}

function mobility(cells, who) {
  let n = 0;
  const f = who === 1 ? -1 : 1;
  for (let i = 0; i < NN; i++) if (cells[i] === who) for (const d of LINES[i]) if (cells[d.n] === 0 && (d.dr === f || d.dr === 0)) n++;
  return n;
}
const HUB = []; for (let i = 0; i < NN; i++) { const [r, c] = rc(i); HUB.push((r + c) % 2 === 0 ? 1 : 0); }
const WIN = 100000;
function children(st) {
  const kids = legalMoves(st).map((mv) => ({ mv, ns: applyMove(st, mv) }));
  kids.sort((x, y) => (y.mv.cap >= 0) - (x.mv.cap >= 0));
  return kids;
}
function terminal(st, me, ply) {
  const o = st.over;
  if (o.winner === 0) return 0;
  return o.winner === me ? WIN - ply : -WIN + ply;
}
function ab(st, depth, alpha, beta, me, ply, budget) {
  if (st.over) return terminal(st, me, ply);
  if (budget.n <= 0) return evaluate(st, me);
  budget.n--;
  const kids = children(st);
  if (!kids.length) return evaluate(st, me);
  // a capture chain does not use up depth (it is one turn)
  if (depth <= 0 && st.chain < 0) {
    // quiescence: keep going while the side to move must capture, so the horizon never falls in the middle of an exchange
    if (kids[0].mv.cap < 0 || ply > 40) return evaluate(st, me);
  }
  const nd = (ns) => (ns.turn === st.turn ? depth : depth - 1);
  if (st.turn === me) {
    let best = -Infinity;
    for (const k of kids) {
      const v = ab(k.ns, nd(k.ns), alpha, beta, me, ply + 1, budget);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = ab(k.ns, nd(k.ns), alpha, beta, me, ply + 1, budget);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// The same search as `ab`, but the upper plies are a generator that yields every QUANTUM nodes, so a long search is sliced into
// pieces of a few milliseconds (the game steps one slice per frame). The deeper plies run in plain recursion.
const QUANTUM = 2500, GEN_PLIES = 7;
function* abY(st, depth, alpha, beta, me, ply, budget) {
  if (st.over) return terminal(st, me, ply);
  if (budget.n <= 0) return evaluate(st, me);
  if (ply >= GEN_PLIES) return ab(st, depth, alpha, beta, me, ply, budget);
  budget.n--;
  const kids = children(st);
  if (!kids.length) return evaluate(st, me);
  if (depth <= 0 && st.chain < 0 && (kids[0].mv.cap < 0 || ply > 40)) return evaluate(st, me);
  const nd = (ns) => (ns.turn === st.turn ? depth : depth - 1);
  if (st.turn === me) {
    let best = -Infinity;
    for (const k of kids) {
      const v = yield* abY(k.ns, nd(k.ns), alpha, beta, me, ply + 1, budget);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
      if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = yield* abY(k.ns, nd(k.ns), alpha, beta, me, ply + 1, budget);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
    if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
  }
  return best;
}

// Iterative deepening, root moves scored exactly. A depth that runs out of budget is thrown away and the last finished depth is kept,
// so a larger budget can only play better. Yields once per root move.
export function* search(st, maxDepth, nodeCap, info) {
  const me = st.turn;
  let kids = children(st);
  let done = kids.map((k) => ({ mv: k.mv, s: 0 }));
  const budget = { n: nodeCap, mark: nodeCap - QUANTUM };
  for (let d = 1; d <= maxDepth; d++) {
    const results = [];
    let aborted = false, best = -Infinity;
    for (const k of kids) {
      const nd = k.ns.turn === me ? d : d - 1;
      // the window narrows once a good move is known: a worse move then only reports "no better than the best so far"
      const v = yield* abY(k.ns, nd, best - 1, Infinity, me, 1, budget);
      if (budget.n <= 0) { aborted = true; break; }
      if (v > best) best = v;
      results.push({ mv: k.mv, s: v, ns: k.ns });
    }
    if (aborted) break;
    done = results.map((x) => ({ mv: x.mv, s: x.s })); done.depth = d; if (info) info.depth = d;
    kids = results.slice().sort((x, y) => y.s - x.s).map((x) => ({ mv: x.mv, ns: x.ns }));
    if (results.length === 1 || results.some((x) => x.s >= WIN / 2) ) break;
  }
  return done;
}

function pickBest(list, rng) {
  let best = -Infinity;
  for (const x of list) if (x.s > best) best = x.s;
  const top = list.filter((x) => x.s >= best - 1e-9);
  return top[rng.int(top.length)];
}

// One decision as a generator: returns the chosen move.
export function* thinkTask(st, level, rng) {
  const moves = legalMoves(st);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const L = levelOf(level);
  if (L.id === 'novice') return moves[rng.int(moves.length)];
  if (L.flaw && rng.chance(L.flaw)) return moves[rng.int(moves.length)];
  const list = yield* search(st, L.depth, L.cap);
  return pickBest(list, rng).mv;
}
export function chooseMove(st, level, rng) {
  const g = thinkTask(st, level, rng);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
export { countOf };
