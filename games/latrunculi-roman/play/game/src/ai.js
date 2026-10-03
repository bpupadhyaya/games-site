// The opponents: alpha-beta over the engine's own moves, with a short capture-only extension at the leaves so a search never
// stops in the middle of an exchange. Five levels, calibrated by simulation (results in STATUS.md).
import {
  NN, ADJ, RAYS, SIDE, DUX, legalMoves, applyMove, quickGain, other, cellName,
} from './rules.js';

export const LEVELS = [
  { id: 'novice', depth: 0, q: 0, cap: 0, noise: 0 },
  { id: 'casual', depth: 1, q: 0, cap: 3000, noise: 0.18 },
  { id: 'skilled', depth: 2, q: 2, cap: 9000, noise: 0.05 },
  { id: 'expert', depth: 3, q: 3, cap: 60000, noise: 0 },
  { id: 'master', depth: 5, q: 4, cap: 300000, noise: 0 },
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

// ------------------------------------------------------------------------------------------------ evaluation
export const ADV = { v: 6 };
const CENTRE_W = [];
for (let i = 0; i < NN; i++) { const r = Math.floor(i / 8), c = i % 8; CENTRE_W.push(3 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) * 0.5); }

function duxDanger(cells, who) {
  const p = cells.indexOf(DUX[who]);
  if (p < 0) return 0;
  const foe = other(who);
  let e = 0, free = 0;
  const adj = ADJ[p];
  for (const j of adj) { const s = SIDE[cells[j]]; if (s === foe) e++; else if (s === 0) free++; }
  // each enemy beside the dux is a step towards enclosure; the fewer open sides it keeps, the worse
  return e * e * 14 + (free === 0 && e > 0 ? 18 : 0);
}

// Soldiers with an enemy on one side of a line and an open square on the other: one move from being sandwiched.
function exposure(cells, who) {
  const foe = other(who), s = who;
  let n = 0;
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== s) continue;
    const r = i >> 3, c = i & 7;
    if (c > 0 && c < 7) { const l = SIDE[cells[i - 1]], rt = SIDE[cells[i + 1]]; if ((l === foe && rt === 0) || (rt === foe && l === 0)) n++; }
    if (r > 0 && r < 7) { const u = SIDE[cells[i - 8]], dn = SIDE[cells[i + 8]]; if ((u === foe && dn === 0) || (dn === foe && u === 0)) n++; }
  }
  return n * 14;
}

function mobilityOf(cells, who) {
  let n = 0;
  for (let i = 0; i < NN; i++) {
    if (SIDE[cells[i]] !== who) continue;
    for (const ray of RAYS[i]) for (let k = 0; k < ray.length; k++) { if (cells[ray[k]] !== 0) break; n++; }
  }
  return n;
}

export function evaluate(st, me) {
  const foe = other(me), cells = st.cells;
  let v = 0;
  for (let i = 0; i < NN; i++) {
    const c = cells[i];
    if (!c) continue;
    const w = SIDE[c] === me ? 1 : -1;
    if (c <= 2) v += w * (100 + CENTRE_W[i] + ADV.v * (c === 1 ? 6 - (i >> 3) : (i >> 3) - 1));
  }
  v += exposure(cells, foe) - exposure(cells, me);
  v += duxDanger(cells, foe) - duxDanger(cells, me);
  v += (mobilityOf(cells, me) - mobilityOf(cells, foe)) * 0.6;
  return v;
}

const WIN = 100000;
function terminal(st, me, depth) {
  const o = st.over;
  if (o.winner === 0) return 0;
  const base = o.why === 'stall' ? WIN / 2 : WIN;
  return o.winner === me ? base - depth : -base + depth;
}

// Moves best-first (captures, then moves that land beside the enemy dux), each with its new state built only when searched.
const HIST = new Int32Array(NN * NN);
const near = (cells, to, foe) => { const dp = cells.indexOf(DUX[foe]); return dp >= 0 && ADJ[dp].includes(to) ? 1 : 0; };
function children(st) {
  const kids = [], cells = st.cells.slice(), me = st.turn;
  for (const mv of legalMoves(st)) {
    const caps = quickGain(cells, mv, me);
    kids.push({ mv, caps, pri: caps * 100000 + near(st.cells, mv.to, other(me)) * 5000 + HIST[mv.from * NN + mv.to], st, _ns: null });
  }
  kids.sort((a, b) => b.pri - a.pri);
  for (const k of kids) Object.defineProperty(k, 'ns', { get() { return this._ns ?? (this._ns = applyMove(this.st, this.mv)); } });
  return kids;
}

// Capture-only extension at the leaves.
function qsearch(st, alpha, beta, me, qd, ply, budget) {
  if (st.over) return terminal(st, me, ply);
  const stand = evaluate(st, me);
  if (qd <= 0 || budget.n <= 0) return stand;
  budget.n--;
  const maxing = st.turn === me;
  if (maxing) { if (stand >= beta) return stand; if (stand > alpha) alpha = stand; } else { if (stand <= alpha) return stand; if (stand < beta) beta = stand; }
  let best = stand;
  const scratch = st.cells.slice();
  for (const mv of legalMoves(st)) {
    if (!quickGain(scratch, mv, st.turn)) continue;
    const ns = applyMove(st, mv);
    const v = qsearch(ns, alpha, beta, me, qd - 1, ply + 1, budget);
    if (maxing) { if (v > best) best = v; if (best > alpha) alpha = best; } else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}

// Transposition table for the deep plies: the same position reached by different move orders is searched once. Keys mix two
// 32-bit position hashes; the table is cleared at the start of every search (scores are from one side's view).
const ZA = new Int32Array(5 * NN), ZB = new Int32Array(5 * NN);
{ const z = seeded(0x2f6e2b1); for (let i = 0; i < ZA.length; i++) { ZA[i] = Math.floor(z.next() * 4294967296) | 0; ZB[i] = Math.floor(z.next() * 4294967296) | 0; } }
let TT = new Map();
function keyOf(st) {
  let a = st.turn === 1 ? 0 : 0x5bd1e995, b = st.turn === 1 ? 0 : 0x1b873593;
  const c = st.cells;
  for (let i = 0; i < NN; i++) { const p = c[i]; if (p) { a ^= ZA[p * NN + i - NN]; b ^= ZB[p * NN + i - NN]; } }
  return (a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff);
}

function ab(st, depth, alpha, beta, me, ply, budget, q) {
  if (st.over) return terminal(st, me, ply);
  if (depth <= 0) return qsearch(st, alpha, beta, me, q, ply, budget);
  if (budget.n <= 0) return evaluate(st, me);
  const key = keyOf(st), ent = TT.get(key);
  if (ent && ent.d >= depth) {
    if (ent.f === 0) return ent.v;
    if (ent.f === 1 && ent.v >= beta) return ent.v;
    if (ent.f === 2 && ent.v <= alpha) return ent.v;
  }
  budget.n--;
  const kids = children(st);
  if (ent && ent.mv >= 0) { for (const k of kids) if (k.mv.from * NN + k.mv.to === ent.mv) { k.pri += 1e9; break; } kids.sort((x, y) => y.pri - x.pri); }
  const a0 = alpha, b0 = beta;
  let best, bestMv = -1, i = 0;
  if (st.turn === me) {
    best = -Infinity;
    for (const k of kids) {
      let v;
      if (depth >= 3 && i++ >= 6 && !k.caps) { v = ab(k.ns, depth - 2, alpha, beta, me, ply + 1, budget, q); if (v > alpha) v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q); }
      else v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q);
      if (v > best) { best = v; bestMv = k.mv.from * NN + k.mv.to; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) { if (!k.caps) HIST[k.mv.from * NN + k.mv.to] += depth * depth; break; }
    }
  } else {
    best = Infinity;
    for (const k of kids) {
      let v;
      if (depth >= 3 && i++ >= 6 && !k.caps) { v = ab(k.ns, depth - 2, alpha, beta, me, ply + 1, budget, q); if (v < beta) v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q); }
      else v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q);
      if (v < best) { best = v; bestMv = k.mv.from * NN + k.mv.to; }
      if (best < beta) beta = best;
      if (alpha >= beta) { if (!k.caps) HIST[k.mv.from * NN + k.mv.to] += depth * depth; break; }
    }
  }
  if (budget.n > 0) {
    if (TT.size > 400000) TT = new Map();
    TT.set(key, { d: depth, v: best, f: best <= a0 ? 2 : best >= b0 ? 1 : 0, mv: bestMv });
  }
  return best;
}

// Nodes of search work between two yields (about one frame of work on a phone).
const QUANTUM = 1500;

// The same search as `ab`, but the first plies are a generator that yields between children, so a long search is sliced into
// small pieces (the game steps one slice per frame). The deeper plies run in plain recursion.
function* abY(st, depth, alpha, beta, me, ply, budget, q) {
  if (st.over) return terminal(st, me, ply);
  if (depth <= 0) return qsearch(st, alpha, beta, me, q, ply, budget);
  if (budget.n <= 0) return evaluate(st, me);
  if (ply >= 3) return ab(st, depth, alpha, beta, me, ply, budget, q);
  budget.n--;
  const kids = children(st);
  if (st.turn === me) {
    let best = -Infinity;
    for (const k of kids) {
      const v = yield* abY(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) { if (!k.caps) HIST[k.mv.from * NN + k.mv.to] += depth * depth; break; }
      if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = yield* abY(k.ns, depth - 1, alpha, beta, me, ply + 1, budget, q);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) { if (!k.caps) HIST[k.mv.from * NN + k.mv.to] += depth * depth; break; }
    if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
  }
  return best;
}

// Iterative deepening, one root move per slice. A depth that runs out of its node budget is thrown away and the last finished
// depth is used, so a bigger budget can only play better. Returns [{ mv, s, caps }] scored from the mover's view.
export function* movementSearch(st, maxDepth, nodeCap, q = 2) {
  const me = st.turn;
  HIST.fill(0);
  TT = new Map();
  let kids = children(st);
  let done = kids.map((k) => ({ mv: k.mv, s: 0, caps: k.caps }));
  done.depth = 0;
  const budget = { n: nodeCap, mark: nodeCap - QUANTUM };
  for (let d = 1; d <= maxDepth; d++) {
    const results = [];
    let best = -Infinity, aborted = false;
    for (const k of kids) {
      // full window on the first move, then "better than the best so far" (a worse move only reports an upper bound)
      const v = yield* abY(k.ns, d - 1, best - 1, Infinity, me, 1, budget, q);
      if (budget.n <= 0) { aborted = true; break; }
      results.push({ mv: k.mv, s: v, caps: k.caps, ns: k.ns });
      if (v > best) best = v;
    }
    if (aborted) break;
    done = results; done.depth = d;
    kids = results.slice().sort((x, y) => y.s - x.s).map((x) => ({ mv: x.mv, ns: x.ns, caps: x.caps }));
    if (best >= WIN / 2 || best <= -WIN / 2) break;
  }
  return done;
}

function pickBest(list, rng, noise = 0) {
  let best = -Infinity;
  for (const x of list) if (x.s > best) best = x.s;
  const top = list.filter((x) => x.s >= best - noise);
  return top[rng.int(top.length)];
}

// ------------------------------------------------------------------------------------------------ choosing a move
export function* thinkTask(st, level, rng) {
  const moves = legalMoves(st);
  if (!moves.length) return null;
  const L = levelOf(level);
  if (L.id === 'novice') {
    const caps = moves.filter((m) => { const n = applyMove(st, m); return n.last.captured.length || n.last.duxTaken; });
    if (caps.length && rng.chance(0.35)) return caps[rng.int(caps.length)];
    return moves[rng.int(moves.length)];
  }
  if (L.noise && rng.chance(L.noise)) {
    // a slip: a random move among the moves (casual) or one of the top three (skilled)
    if (L.id === 'casual') return moves[rng.int(moves.length)];
  }
  const list = yield* movementSearch(st, L.depth, L.cap, L.q);
  if (L.id === 'skilled' && rng.chance(L.noise)) { list.sort((a, b) => b.s - a.s); return list[Math.min(list.length - 1, rng.int(3))].mv; }
  // a little variety among equal moves keeps games from repeating
  return pickBest(list, rng, L.id === 'casual' ? 6 : 0).mv;
}
export function chooseMove(st, level, rng) {
  const g = thinkTask(st, level, rng);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
export { cellName };
