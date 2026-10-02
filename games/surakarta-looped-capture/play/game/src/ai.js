// Opponents, Beginner to Master. All are built on one alpha-beta search with a capture-only extension at the leaves;
// the levels differ in search depth, how much random noise is added to the scores, and a node budget. Searching is
// counted in nodes (never in time) so the same position always gives the same answer for the same rng stream, and a
// search can be sliced across frames (createSearch / step) so the screen never freezes while the computer thinks.
import { NN, genMoves, other, onCircuit, attackedBy, colOf, rowOf, countOf } from './rules.js';

export const LEVELS = [
  { id: 'beginner', name: 'Beginner', blurb: 'Plays quickly, grabs a capture when it sees one and leaves pieces hanging.', depth: 0, q: 0, noise: 0, nodes: 0, grab: 0.55 },
  { id: 'casual', name: 'Casual', blurb: 'Looks one move ahead. Takes free pieces but misses traps.', depth: 1, q: 1, noise: 70, nodes: 4000 },
  { id: 'skilled', name: 'Skilled', blurb: 'Looks two moves ahead and rarely leaves a piece on a live circuit.', depth: 2, q: 2, noise: 25, nodes: 14000 },
  { id: 'expert', name: 'Expert', blurb: 'Looks three moves ahead, follows exchanges and plans threats.', depth: 3, q: 3, noise: 6, nodes: 45000 },
  { id: 'master', name: 'Master', blurb: 'Searches as deep as it can: the strongest opponent here.', depth: 7, q: 4, noise: 0, nodes: 500000 },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

const MATE = 100000;
const CENT = (() => { const a = []; for (let i = 0; i < NN; i++) { const dx = colOf(i) - 2.5, dy = rowOf(i) - 2.5; a.push(3.5 - Math.hypot(dx, dy)); } return a; })();

// Score of the position for `me` (higher is better), assuming `me` is to move.
export function evaluate(cells, me) {
  const opp = other(me);
  let mat = 0, circ = 0, cent = 0;
  for (let i = 0; i < NN; i++) {
    const v = cells[i];
    if (!v) continue;
    const s = v === me ? 1 : -1;
    mat += s;
    if (onCircuit(i)) circ += s;
    cent += s * CENT[i];
  }
  const mine = attackedBy(cells, me).size, theirs = attackedBy(cells, opp).size;
  return 100 * mat + 12 * mine - 9 * theirs + 2 * circ + 1.5 * cent;
}

function order(moves) {
  // captures first
  const caps = [], steps = [];
  for (const m of moves) (m.cap ? caps : steps).push(m);
  return caps.concat(steps);
}

function make(cells, m) { const taken = cells[m.to]; cells[m.to] = cells[m.from]; cells[m.from] = 0; return taken; }
function unmake(cells, m, taken) { cells[m.from] = cells[m.to]; cells[m.to] = taken; }

class Abort extends Error {}

function quiesce(cells, who, alpha, beta, qd, ctx) {
  ctx.nodes++;
  const stand = evaluate(cells, who);
  if (qd <= 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of genMoves(cells, who, true)) {
    const taken = make(cells, m);
    const sc = ctx.left[other(who)] === 1 ? MATE : -quiesce(cells, other(who), -beta, -alpha, qd - 1, ctx);
    unmake(cells, m, taken);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function negamax(cells, who, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes > ctx.max) throw new Abort();
  if (depth <= 0) return quiesce(cells, who, alpha, beta, ctx.q, ctx);
  const moves = order(genMoves(cells, who));
  if (!moves.length) return -MATE + ply;
  let best = -Infinity;
  for (const m of moves) {
    const taken = make(cells, m);
    let sc;
    if (taken) {
      ctx.left[other(who)]--;
      sc = ctx.left[other(who)] === 0 ? MATE - ply : -negamax(cells, other(who), depth - 1, -beta, -alpha, ply + 1, ctx);
      ctx.left[other(who)]++;
    } else sc = -negamax(cells, other(who), depth - 1, -beta, -alpha, ply + 1, ctx);
    unmake(cells, m, taken);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// A sliceable search. step(maxNodes) works until it has used about maxNodes nodes, returns true when finished.
// result() is { mv, list } where list holds every root move with the score it received.
export function createSearch(st, level, rng) {
  const lv = typeof level === 'string' ? levelById(level) : level;
  const who = st.turn;
  const cells = st.cells.slice();
  const roots = rng.shuffle(genMoves(cells, who));
  const S = { done: false, mv: null, list: [], depth: 0, i: 0, scores: null, ctx: null, used: 0 };
  if (!roots.length) { S.done = true; return { step: () => true, result: () => S, level: lv }; }
  if (lv.depth === 0) {
    const caps = roots.filter((m) => m.cap);
    const pick = caps.length && rng.chance(lv.grab) ? rng.pick(caps) : rng.pick(roots);
    S.mv = pick; S.list = roots.map((m) => ({ mv: m, s: 0 })); S.done = true;
    return { step: () => true, result: () => S, level: lv };
  }
  const left = { 1: countOf(cells, 1), 2: countOf(cells, 2) };
  const ordered = order(roots);
  let cur = null; // scores of the depth being searched
  let prev = null; // scores of the last finished depth
  const startDepth = (d) => { S.depth = d; S.i = 0; cur = ordered.map((m) => ({ mv: m, s: -Infinity })); if (prev) cur.sort((a, b) => prev.find((p) => p.mv === b.mv).s - prev.find((p) => p.mv === a.mv).s); };
  startDepth(1);
  const exact = lv.noise > 0; // noisy levels need every root score exact
  const api = {
    level: lv,
    step(maxNodes) {
      if (S.done) return true;
      const ctx = S.ctx ?? (S.ctx = { nodes: 0, max: lv.nodes, q: lv.q, left });
      const startNodes = ctx.nodes;
      while (!S.done) {
        if (ctx.nodes - startNodes >= maxNodes) return false;
        const e = cur[S.i], m = e.mv;
        const bestSoFar = Math.max(-Infinity, ...cur.slice(0, S.i).map((x) => x.s));
        let aborted = false;
        try {
          const taken = make(cells, m);
          let sc;
          if (taken) {
            left[other(who)]--;
            sc = left[other(who)] === 0 ? MATE : -negamax(cells, other(who), S.depth - 1, -Infinity, exact ? Infinity : -(bestSoFar - 1), 1, ctx);
            left[other(who)]++;
          } else sc = -negamax(cells, other(who), S.depth - 1, -Infinity, exact ? Infinity : -(bestSoFar - 1), 1, ctx);
          unmake(cells, m, taken);
          e.s = sc;
        } catch (err) {
          if (!(err instanceof Abort)) throw err;
          aborted = true;
          // restore the board: the search was cut in the middle of a make
          cells.splice(0, NN, ...st.cells);
          left[1] = countOf(cells, 1); left[2] = countOf(cells, 2);
        }
        S.used = ctx.nodes;
        if (aborted || ctx.nodes >= lv.nodes) {
          // out of budget: keep the last finished depth (or this one when nothing finished yet)
          if (!prev) { prev = cur.map((x) => ({ mv: x.mv, s: x.s === -Infinity ? -MATE : x.s })); }
          S.done = true; break;
        }
        S.i++;
        if (S.i >= cur.length) {
          prev = cur.slice();
          if (S.depth >= lv.depth) { S.done = true; break; }
          startDepth(S.depth + 1);
        }
      }
      finish();
      return true;
    },
    result: () => S,
  };
  function finish() {
    const list = (prev ?? cur).map((x) => ({ mv: x.mv, s: x.s === -Infinity ? -MATE : x.s }));
    // noise: only for levels that ask for it
    const noisy = list.map((x) => ({ ...x, n: x.s + (lv.noise ? (rng.next() * 2 - 1) * lv.noise : 0) }));
    let best = noisy[0];
    for (const x of noisy) if (x.n > best.n) best = x;
    S.list = list; S.mv = best.mv;
  }
  return api;
}

// Runs a whole search at once (tests, calibration, Think when time-slicing is not needed).
export function searchNow(st, level, rng) {
  const s = createSearch(st, level, rng);
  while (!s.step(1e9)) { /* run to the end */ }
  return s.result();
}

export function chooseMove(st, level, rng) {
  const r = searchNow(st, level, rng);
  return r.mv;
}
