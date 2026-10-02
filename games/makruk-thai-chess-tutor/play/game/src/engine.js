// The computer's brain for Makruk. Negamax alpha-beta with a transposition table, iterative deepening, capture
// quiescence, killer/history ordering, check extensions and an endgame "mop-up" term for driving a lone Khun to the
// edge. It uses rules.js for move generation, so it plays exactly the real rules.
//
// It never blocks a frame: createThinker(...).step() searches at most STEP_NODES nodes and returns. When a step's
// budget runs out the search throws ABORT and the next step re-walks the same path; finished sub-trees are already in
// the transposition table. Work is counted in nodes, never wall-clock time, so play is deterministic.
import {
  genInto, attacked, findKing, legalMovesRaw, mFrom, mTo, mPromo, WHITE, BLACK, BIA, MET, KHON, MA, RUA, KHUN, NGAI, fileOf, rankOf,
} from './rules.js';

export const STEP_NODES = 8000;
const MATE = 30000, INF = 32000, ABORT = { abort: true };

// depth = deepest iteration; budget = total nodes for the whole move; noise = centipawn wobble on the root choice
// (weaker, more human); random = chance of simply playing a random legal move; margin = near-equal moves that may be
// chosen between (variety at the top levels).
export const LEVELS = [
  null,
  { name: 'Beginner', blurb: 'Plays quickly and misses tactics. Good for learning the moves.', depth: 1, budget: 900, noise: 260, random: 0.3, margin: 0 },
  { name: 'Casual', blurb: 'Sees short tactics but still slips up.', depth: 2, budget: 6000, noise: 110, random: 0.07, margin: 0 },
  { name: 'Club', blurb: 'A solid player. Takes free pieces and avoids simple traps.', depth: 4, budget: 40000, noise: 25, random: 0, margin: 0 },
  { name: 'Expert', blurb: 'Plans several moves ahead. Hard to out-tactic.', depth: 7, budget: 300000, noise: 0, random: 0, margin: 8 },
  { name: 'Master', blurb: 'The deepest search. It will punish every mistake.', depth: 10, budget: 1200000, noise: 0, random: 0, margin: 3 },
];
export const LEVEL_COUNT = LEVELS.length - 1;

// ---- evaluation -------------------------------------------------------------------------------------------------------
const VAL = [0, 100, 200, 250, 300, 520, 0, 200];
const CEN = new Int8Array(64);
for (let s = 0; s < 64; s++) { const f = fileOf(s), r = rankOf(s); CEN[s] = 6 - Math.round(Math.abs(f - 3.5) + Math.abs(r - 3.5)); } // 0..~6
const centerDist = (s) => Math.max(Math.abs(fileOf(s) - 3.5), Math.abs(rankOf(s) - 3.5)); // 0.5..3.5
const kingDist = (a, c) => Math.max(Math.abs(fileOf(a) - fileOf(c)), Math.abs(rankOf(a) - rankOf(c)));
const BIA_ADV = [0, 0, 0, 7, 22, 48, 0, 0];

function evaluate(b, side) {
  let v = 0, wp = 0, bp = 0, wk = -1, bk = -1, wmob = 0, bmob = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (p === 0) continue;
    const t = p > 0 ? p : -p, white = p > 0, rr = white ? rankOf(s) : 7 - rankOf(s), sign = white ? 1 : -1;
    let x = VAL[t];
    if (t === KHUN) { if (white) wk = s; else bk = s; x = 0; }
    else {
      if (white) wp++; else bp++;
      if (t === BIA) { x += BIA_ADV[rr]; if (fileOf(s) >= 2 && fileOf(s) <= 5) x += 3; }
      else if (t === MA) x += CEN[s] * 7 - 14;
      else if (t === KHON) x += CEN[s] * 4 + rr * 2;
      else if (t === MET || t === NGAI) x += CEN[s] * 2;
      else if (t === RUA) { x += (rr >= 4 ? 8 : 0); if (white) { let open = true; for (let r = rankOf(s) + 1; r < 8; r++) if (b[r * 8 + fileOf(s)] === BIA || b[r * 8 + fileOf(s)] === -BIA) { open = false; break; } if (open) x += 12; } else { let open = true; for (let r = rankOf(s) - 1; r >= 0; r--) if (b[r * 8 + fileOf(s)] === BIA || b[r * 8 + fileOf(s)] === -BIA) { open = false; break; } if (open) x += 12; } }
      if (t === RUA) { /* mobility proxy folded into open-file bonus */ }
    }
    v += sign * x;
  }
  void wmob; void bmob;
  // king shelter: a king that wanders forward early is exposed while many pieces remain
  const mat = wp + bp;
  if (mat >= 8) { if (wk >= 0) v -= Math.max(0, rankOf(wk) - 1) * 10; if (bk >= 0) v += Math.max(0, 6 - rankOf(bk)) * 10; }
  // mop-up: drive a lone Khun to the edge and bring your own Khun close
  if (wp > 0 && bp === 0 && wk >= 0 && bk >= 0) v += Math.round(centerDist(bk) * 28 + (7 - kingDist(wk, bk)) * 14);
  if (bp > 0 && wp === 0 && wk >= 0 && bk >= 0) v -= Math.round(centerDist(wk) * 28 + (7 - kingDist(wk, bk)) * 14);
  return (side === WHITE ? v : -v) + 8;
}

// ---- hashing -----------------------------------------------------------------------------------------------------------
const ZOB = new Int32Array(15 * 64), ZSIDE = 0x5bd1e995 | 0;
{ let x = 0x1234567; for (let i = 0; i < ZOB.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ZOB[i] = x | 0; } }
export function hashBoard(b, side) { let h = side === BLACK ? ZSIDE : 0; for (let s = 0; s < 64; s++) if (b[s]) h ^= ZOB[(b[s] + 7) * 64 + s]; return h | 0; }

// ---- search ------------------------------------------------------------------------------------------------------------
const TT_BITS = 17, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
function makeSearcher() {
  const b = new Int8Array(64);
  const ttKey = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE);
  const moves = [], scores = [];
  for (let i = 0; i < 80; i++) { moves.push(new Int32Array(160)); scores.push(new Int32Array(160)); }
  const killers = new Int32Array(80 * 2), history = new Int32Array(2 * 64 * 64);
  const path = new Int32Array(100);
  let h = 0, side = WHITE, nodes = 0, limit = 0, histSet = null;

  function load(board, turn, hist) { b.set(board); side = turn; h = hashBoard(b, turn); histSet = new Set(hist || []); path.fill(0); path[0] = h; }
  function make(m) {
    const f = mFrom(m), t = mTo(m), p = b[f], cap = b[t];
    h ^= ZOB[(p + 7) * 64 + f];
    if (cap) h ^= ZOB[(cap + 7) * 64 + t];
    const placed = mPromo(m) ? (p > 0 ? NGAI : -NGAI) : p;
    b[t] = placed; b[f] = 0; h ^= ZOB[(placed + 7) * 64 + t] ^ ZSIDE; side = -side;
    return cap;
  }
  function unmake(m, cap, oldH) {
    const f = mFrom(m), t = mTo(m), p = b[t];
    side = -side; b[f] = mPromo(m) ? (p > 0 ? BIA : -BIA) : p; b[t] = cap; h = oldH;
  }
  const kingHit = (s) => { const k = findKing(b, s); return k >= 0 && attacked(b, k, -s); };
  function score(list, sc, n, ply, ttm, me) {
    const si = me > 0 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const m = list[i], f = mFrom(m), t = mTo(m), v = b[t];
      let s;
      if (m === ttm) s = 1e7;
      else if (v) s = 1e6 + (v > 0 ? v : -v) * 100 - (b[f] > 0 ? b[f] : -b[f]);
      else if (mPromo(m)) s = 9.5e5;
      else if (m === killers[ply * 2]) s = 9e5; else if (m === killers[ply * 2 + 1]) s = 8e5;
      else s = history[(si * 64 + f) * 64 + t];
      sc[i] = s;
    }
  }
  function pick(list, sc, n, i) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) { const m = list[i], s = sc[i]; list[i] = list[best]; sc[i] = sc[best]; list[best] = m; sc[best] = s; }
    return list[i];
  }
  function quiesce(alpha, beta, ply, qd) {
    if (++nodes > limit) throw ABORT;
    const stand = evaluate(b, side);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6 || ply >= 78) return alpha;
    const list = moves[ply], sc = scores[ply], me = side;
    const n = genInto(b, me, list, 0, true);
    score(list, sc, n, ply, 0, me);
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), oh = h, cap = make(m);
      if (kingHit(me)) { unmake(m, cap, oh); continue; }
      const val = -quiesce(-beta, -alpha, ply + 1, qd + 1);
      unmake(m, cap, oh);
      if (val >= beta) return val;
      if (val > alpha) alpha = val;
    }
    return alpha;
  }
  function search(depth, alpha, beta, ply) {
    if (++nodes > limit) throw ABORT;
    if (ply > 0) {
      for (let i = ply - 2; i >= 0; i -= 2) if (path[i] === h) return 0;
      if (histSet.has(h)) return 0;
    }
    path[ply] = h;
    const me = side, inChk = kingHit(me);
    if (inChk && ply < 40) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply, 0);
    if (ply >= 76) return evaluate(b, side);
    const slot = (h ^ (h >>> 15)) & TT_MASK;
    let ttm = 0;
    if (ttKey[slot] === h && ttFlag[slot] !== 0) {
      ttm = ttMove[slot];
      if (ttDepth[slot] >= depth) {
        let s = ttScore[slot]; if (s > MATE - 200) s -= ply; else if (s < -MATE + 200) s += ply;
        const fl = ttFlag[slot];
        if (fl === 1) return s; if (fl === 2 && s >= beta) return s; if (fl === 3 && s <= alpha) return s;
      }
    }
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, me, list, 0, false);
    score(list, sc, n, ply, ttm, me);
    let best = -INF, bestMove = 0, legal = 0;
    const a0 = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), oh = h, cap = make(m);
      if (kingHit(me)) { unmake(m, cap, oh); continue; }
      legal++;
      const val = -search(depth - 1, -beta, -alpha, ply + 1);
      unmake(m, cap, oh);
      if (val > best) {
        best = val; bestMove = m;
        if (val > alpha) {
          alpha = val;
          if (val >= beta) {
            if (!cap) { const k = ply * 2; if (killers[k] !== m) { killers[k + 1] = killers[k]; killers[k] = m; } history[((me > 0 ? 0 : 1) * 64 + mFrom(m)) * 64 + mTo(m)] += depth * depth; }
            break;
          }
        }
      }
    }
    if (legal === 0) return inChk ? -MATE + ply : 0;
    let store = best; if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
    const fl = best <= a0 ? 3 : best >= beta ? 2 : 1;
    if (ttFlag[slot] === 0 || ttDepth[slot] <= depth) { ttKey[slot] = h; ttDepth[slot] = depth; ttFlag[slot] = fl; ttScore[slot] = store; ttMove[slot] = bestMove; }
    return best;
  }
  return {
    load, make, unmake, search,
    get nodes() { return nodes; },
    get hash() { return h; },
    setBudget(l) { nodes = 0; limit = l; },
    clearHeuristics() { killers.fill(0); history.fill(0); },
    clearTT() { ttFlag.fill(0); },
  };
}
let SHARED = null; // one searcher is reused by every thinker; only one thinks at a time

const asMove = (m) => ({ from: mFrom(m), to: mTo(m), promo: !!mPromo(m), m });
// A thinker searches a little each time step() is called; returns { move } or { move: undefined } while working.
// `scored` (on the finished result) lists { move, v } best first, for Think and for explaining a choice.
export function createThinker(g, level, rng, opts = {}) {
  const L = opts.level || LEVELS[level] || LEVELS[3];
  const legal = legalMovesRaw(g.board, g.turn);
  if (legal.length === 0) return { step: () => ({ move: null, scored: [] }), nodes: 0 };
  const s = SHARED || (SHARED = makeSearcher());
  const rootBoard = g.board.slice(), turn = g.turn;
  const hist = []; for (let i = 0; i < g.hist.length; i++) hist.push(hashBoard(g.hist[i].board, g.hist[i].turn));
  let order = legal.slice(), nv = [], vals = order.map(() => 0), rootI = 0, depth = 1, alpha = -INF, best = -INF, doneDepths = 0, started = false, finished = null;
  const total = { nodes: 0 };
  const exact = L.noise > 0;
  const finish = () => {
    const scored = order.map((m, i) => ({ move: asMove(m), v: vals[i] }));
    let pickM = order[0];
    if (order.length > 1) {
      if (L.random && rng.next() < L.random) pickM = order[rng.int(order.length)];
      else if (L.noise) { let top = -Infinity; for (let i = 0; i < order.length; i++) { const v = vals[i] + (rng.next() * 2 - 1) * L.noise; if (v > top) { top = v; pickM = order[i]; } } }
      else if (L.margin) { const cand = []; for (let i = 0; i < order.length; i++) if (i === 0 || vals[i] > vals[0] - L.margin) cand.push(order[i]); pickM = cand[rng.int(cand.length)]; }
    }
    return { move: asMove(pickM), scored, depth, nodes: total.nodes };
  };
  return {
    get nodes() { return total.nodes; },
    get depth() { return depth; },
    step() {
      if (finished) return finished;
      if (order.length === 1 && !opts.force) { finished = finish(); return finished; }
      if (!started) { s.clearHeuristics(); s.clearTT(); started = true; }
      if (doneDepths > 0 && total.nodes >= (opts.budget || L.budget)) { finished = finish(); return finished; }
      s.setBudget(STEP_NODES);
      let out = { move: undefined };
      try {
        s.load(rootBoard, turn, hist);
        const oh = s.hash;
        for (;;) {
          while (rootI < order.length) {
            const m = order[rootI], cap = s.make(m);
            const lo = exact ? -INF : alpha - L.margin;
            const v = -s.search(depth - 1, -INF, exact ? INF : -lo, 1);
            s.unmake(m, cap, oh);
            nv[rootI] = v; if (v > best) { best = v; if (!exact) alpha = v; } rootI++;
          }
          const idxs = order.map((m, k) => k).sort((a, c) => nv[c] - nv[a] || a - c);
          order = idxs.map((k) => order[k]); vals = idxs.map((k) => nv[k]); doneDepths++;
          if (depth >= (opts.depth || L.depth) || total.nodes + s.nodes > (opts.budget || L.budget) || Math.abs(vals[0]) > MATE - 400) { finished = finish(); out = finished; break; }
          depth++; rootI = 0; nv = []; alpha = -INF; best = -INF;
        }
      } catch (e) { if (e !== ABORT) throw e; }
      total.nodes += s.nodes;
      return out;
    },
  };
}
// Run a thinker to completion (tests, self-play, screenshots).
export function chooseMove(g, level, rng, opts) { const t = createThinker(g, level, rng, opts); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
export const staticEval = (b, side) => evaluate(b, side);
void MET; void KHON; void MA; void RUA; void KHUN; void BIA;
