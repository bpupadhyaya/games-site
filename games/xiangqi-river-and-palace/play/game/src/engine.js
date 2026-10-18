// The computer's brain. Alpha-beta negamax with a transposition table, iterative deepening, check extension,
// capture quiescence, killer/history move ordering. It uses rules.js for move generation, so it plays exactly the
// real rules.
//
// It never blocks a frame: createThinker(...).step() searches at most STEP_NODES nodes and returns. When the node
// budget for a step runs out the search throws ABORT, and the next step re-walks the same path; every finished
// sub-tree is already in the transposition table, so little work is repeated. Work is counted in NODES, never in
// time, so the game stays deterministic.
import { genInto, attacked, kingSquare, positionKey, zIndex, ZOB_L, ZOB_H, SIDE_L, SIDE_H, keyNum, legalPacked, RED, BLACK, GENERAL, ADVISOR, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER, xOf, yOf, sqOf } from './rules.js';

export const STEP_NODES = 3000;      // nodes per step(): about 1 ms on a laptop, a few ms on a phone-class CPU
const MATE = 30000, INF = 32000;
const ABORT = { abort: true };

// One strength table. depth = deepest iteration; budget = total nodes the search may spend; noise = centipawns of
// random wobble added to each root move (weaker play); random = chance to simply play a random legal move.
export const LEVELS = [
  null,
  { name: 'Beginner', depth: 1, budget: 4000, noise: 260, random: 0.32, quiet: false },
  { name: 'Easy', depth: 2, budget: 9000, noise: 110, random: 0.10, quiet: true },
  { name: 'Medium', depth: 3, budget: 45000, noise: 30, random: 0, quiet: true },
  { name: 'Hard', depth: 5, budget: 160000, noise: 0, random: 0, quiet: true },
  { name: 'Master', depth: 9, budget: 420000, noise: 0, random: 0, quiet: true },
];
export const LEVEL_COUNT = 5;

// ---- evaluation ------------------------------------------------------------------------------------------------
const VAL = [0, 0, 220, 220, 430, 950, 470, 100];
const PST = [null, [new Int16Array(90), new Int16Array(90)]];
for (let t = 1; t <= 7; t++) PST[t] = [new Int16Array(90), new Int16Array(90)];
for (let s = 0; s < 90; s++) {
  const x = xOf(s), y = yOf(s);                        // Red's view: y = 9 is home
  const adv = 9 - y, cx = 4 - Math.abs(x - 4), dcx = Math.abs(x - 4);
  const set = (t, v) => { PST[t][0][s] = v; PST[t][1][89 - s] = v; };   // mirrored for Black: 89 - s maps (x,y) to (8-x, 9-y), fine (symmetric board)
  set(GENERAL, y === 9 ? 0 : y === 8 ? -6 : -20);
  set(ADVISOR, (x === 4 && y === 8) ? 10 : 6);
  set(ELEPHANT, (y === 7 && (x === 2 || x === 6)) ? 8 : (y === 9 ? 0 : 4));
  set(HORSE, cx * 7 + Math.min(adv, 6) * 4 + (adv >= 8 ? -14 : 0) + (dcx === 4 ? -22 : 0));
  set(CHARIOT, Math.min(adv, 7) * 4 + (x === 4 || x === 3 || x === 5 ? 6 : 0) + (adv === 0 ? -20 : 0));
  set(CANNON, (x === 4 ? 24 : 0) + Math.min(adv, 6) * 3 + (dcx === 4 ? -8 : 0));
  let sp;
  if (adv <= 3) sp = 0 + (adv === 3 ? 6 : 0) + (x % 2 === 0 ? 4 : 0);               // at home rows: y 6..9 (adv 3..0)
  else if (adv <= 4) sp = 0;
  else sp = 100 + (adv - 5) * 34 + (x >= 3 && x <= 5 ? 26 : 0) - (adv === 9 ? 40 : 0);   // crossed the river (y <= 4)
  set(SOLDIER, adv >= 5 ? sp : (adv === 3 ? 10 : 0));
}
// side-to-move bonus
const TEMPO = 12;

function evaluate(b, side) {
  let v = 0, rc = 0, bc = 0;                            // attackers each side has (chariot/horse/cannon), for a small king-safety term
  let redDef = 0, blackDef = 0;
  for (let s = 0; s < 90; s++) {
    const p = b[s]; if (p === 0) continue;
    if (p > 0) { v += VAL[p] + PST[p][0][s]; if (p >= HORSE && p <= CANNON) rc++; else if (p === ADVISOR || p === ELEPHANT) redDef++; }
    else { v -= VAL[-p] + PST[-p][1][s]; if (-p >= HORSE && -p <= CANNON) bc++; else if (-p === ADVISOR || -p === ELEPHANT) blackDef++; }
  }
  // defenders matter when the enemy still has attackers
  v += (redDef - 2) * Math.min(bc, 4) * 6 - (blackDef - 2) * Math.min(rc, 4) * 6;
  return (side === RED ? v : -v) + TEMPO;
}

// ---- search state ----------------------------------------------------------------------------------------------
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
function makeSearcher() {
  const b = new Int8Array(90), ksq = new Int16Array(2);
  const ttKey = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE), ttMove = new Int16Array(TT_SIZE);
  const moves = []; for (let i = 0; i < 80; i++) moves.push(new Int32Array(160));
  const scores = []; for (let i = 0; i < 80; i++) scores.push(new Int32Array(160));
  const killers = new Int16Array(80 * 2), history = new Int32Array(2 * 90 * 90);
  const path = new Float64Array(80);                    // position keys along the current line (repetition = draw)
  let hl = 0, hh = 0, side = RED, nodes = 0, limit = 0, useQ = true, histSet = null, rootPly = 0;
  const S = { b, nodes: () => nodes };

  const sideIdx = (s) => (s > 0 ? 0 : 1);
  function load(board, turn, keys) {
    hl = turn === BLACK ? SIDE_L : 0; hh = turn === BLACK ? SIDE_H : 0;
    for (let s = 0; s < 90; s++) { b[s] = board[s]; if (board[s]) { hl ^= ZOB_L[zIndex(board[s], s)]; hh ^= ZOB_H[zIndex(board[s], s)]; } }
    side = turn; ksq[0] = kingSquare(b, RED); ksq[1] = kingSquare(b, BLACK);
    histSet = new Set(keys || []); path.fill(0); path[0] = keyNum(hl, hh);
  }
  function make(m) {
    const f = m & 127, t = m >> 7, p = b[f], c = b[t];
    hl ^= ZOB_L[zIndex(p, f)] ^ ZOB_L[zIndex(p, t)] ^ SIDE_L; hh ^= ZOB_H[zIndex(p, f)] ^ ZOB_H[zIndex(p, t)] ^ SIDE_H;
    if (c) { hl ^= ZOB_L[zIndex(c, t)]; hh ^= ZOB_H[zIndex(c, t)]; }
    b[t] = p; b[f] = 0;
    if (p === 1 || p === -1) ksq[p > 0 ? 0 : 1] = t;
    side = -side;
    return c;
  }
  function unmake(m, c, sl, sh) {
    const f = m & 127, t = m >> 7, p = b[t];
    b[f] = p; b[t] = c; hl = sl; hh = sh; side = -side;
    if (p === 1 || p === -1) ksq[p > 0 ? 0 : 1] = f;
  }
  const kingHit = (s) => attacked(b, ksq[s > 0 ? 0 : 1], -s);   // is side s's general attacked

  function score(list, sc, n, ply, ttm, stm) {
    const si = stm > 0 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const m = list[i], f = m & 127, t = m >> 7, v = b[t];
      let s;
      if (m === ttm) s = 1e7;
      else if (v) s = 1e6 + (v > 0 ? v : -v) * 16 - (b[f] > 0 ? b[f] : -b[f]);
      else if (m === killers[ply * 2]) s = 9e5; else if (m === killers[ply * 2 + 1]) s = 8e5;
      else s = history[(si * 90 + f) * 90 + t];
      sc[i] = s;
    }
  }
  function pick(list, sc, n, i) {                       // selection sort step: bring the best remaining move to slot i
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) { const m = list[i], s = sc[i]; list[i] = list[best]; sc[i] = sc[best]; list[best] = m; sc[best] = s; }
    return list[i];
  }

  function quiesce(alpha, beta, ply, qd) {
    if (++nodes > limit) throw ABORT;
    const stand = evaluate(b, side);
    if (stand >= beta || qd >= 8) return stand;
    if (stand > alpha) alpha = stand;
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, side, list, 0, true);
    score(list, sc, n, ply, 0, side);
    const me = side;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), t = m >> 7, sl = hl, sh = hh;
      const v = b[t]; if ((v > 0 ? v : -v) === GENERAL) continue;
      const c = make(m);
      if (kingHit(me)) { unmake(m, c, sl, sh); continue; }
      const val = -quiesce(-beta, -alpha, ply + 1, qd + 1);
      unmake(m, c, sl, sh);
      if (val >= beta) return val;
      if (val > alpha) alpha = val;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply) {
    if (++nodes > limit) throw ABORT;
    const key = keyNum(hl, hh);
    if (ply > 0) {
      for (let i = ply - 2; i >= 0; i -= 2) if (path[i] === key) return 0;
      if (histSet.has(key)) return 0;
    }
    path[ply] = key;
    const me = side, inChk = kingHit(me);
    if (inChk && ply < 30) depth++;
    if (depth <= 0) return useQ ? quiesce(alpha, beta, ply, 0) : evaluate(b, side);
    if (ply >= 60) return evaluate(b, side);
    const slot = hl & TT_MASK;
    let ttm = 0;
    if (ttKey[slot] === hh && ttFlag[slot] !== 0) {
      ttm = ttMove[slot];
      if (ttDepth[slot] >= depth) {
        let s = ttScore[slot]; if (s > MATE - 100) s -= ply; else if (s < -MATE + 100) s += ply;
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
      const m = pick(list, sc, n, i), sl = hl, sh = hh;
      const c = make(m);
      if (kingHit(me)) { unmake(m, c, sl, sh); continue; }
      legal++;
      const val = -search(depth - 1, -beta, -alpha, ply + 1);
      unmake(m, c, sl, sh);
      if (val > best) { best = val; bestMove = m; if (val > alpha) { alpha = val; if (val >= beta) { if (!c) { const k = ply * 2; if (killers[k] !== m) { killers[k + 1] = killers[k]; killers[k] = m; } history[(sideIdx(me) * 90 + (m & 127)) * 90 + (m >> 7)] += depth * depth; } break; } } }
    }
    if (legal === 0) return -MATE + ply;                // no legal move = a loss (checkmate or stalemate)
    let store = best; if (store > MATE - 100) store += ply; else if (store < -MATE + 100) store -= ply;
    const fl = best <= a0 ? 3 : best >= beta ? 2 : 1;
    if (ttFlag[slot] === 0 || ttDepth[slot] <= depth || ttKey[slot] !== hh) { ttKey[slot] = hh; ttDepth[slot] = depth; ttFlag[slot] = fl; ttScore[slot] = store; ttMove[slot] = bestMove; }
    return best;
  }

  return {
    b, load, make, unmake, search, kingHit,
    get nodes() { return nodes; },
    setBudget(l, q) { nodes = 0; limit = l; useQ = q; },
    clearHeuristics() { killers.fill(0); history.fill(0); },
    clearTT() { ttFlag.fill(0); },
    hash: () => [hl, hh],
    setSide: (s) => { side = s; },
    get side() { return side; },
  };
}
let SHARED = null;      // one searcher (and its tables) is reused by every thinker; only one thinks at a time

// A thinker searches a little each time step() is called; it returns { move } (a { from, to } or null) when done, { move: undefined } otherwise.
export function createThinker(g, level, rng) {
  const L = LEVELS[level] ?? LEVELS[3];
  const s = SHARED || (SHARED = makeSearcher());
  const rootBoard = g.board.slice(), turn = g.turn, keys = g.keys.slice();
  const rootMoves = legalPacked(rootBoard, turn);
  const total = { nodes: 0 };
  let rootI = 0, nv = [], alpha = -INF, doneDepths = 0, depth = 1, vals = rootMoves.map(() => 0), order = rootMoves.slice(), done = rootMoves.length <= 1, started = false, best = -INF;
  const exact = L.noise > 0;
  let finished = null;

  const finish = () => {
    if (rootMoves.length === 0) return null;
    const asMove = (m) => ({ from: m & 127, to: m >> 7 });
    if (rootMoves.length === 1) return asMove(rootMoves[0]);
    if (rng.next() < L.random) return asMove(rootMoves[rng.int(rootMoves.length)]);
    if (!L.noise) return asMove(order[0]);             // exact best first; the other values are only bounds
    let pickI = 0, top = -Infinity;
    for (let i = 0; i < order.length; i++) {
      const v = vals[i] + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.5;
      if (v > top) { top = v; pickI = i; }
    }
    return asMove(order[pickI]);
  };
  return {
    get nodes() { return total.nodes; },
    get depth() { return depth; },
    get info() { return { order, vals, done: doneDepths }; },
    step() {
      if (finished) return finished;
      if (done) { finished = { move: finish() }; return finished; }
      if (!started) { s.clearHeuristics(); s.clearTT(); started = true; }
      if (doneDepths > 0 && total.nodes >= L.budget) { finished = { move: finish() }; return finished; }   // hard budget: play the last finished iteration's choice
      s.setBudget(STEP_NODES, L.quiet);
      let out = { move: undefined };
      try {
        s.load(rootBoard, turn, keys);                  // every step starts from a clean copy of the root
        for (;;) {
          // one iteration at `depth`, resumable at root-move granularity: finished root moves are never redone
          const h = s.hash(), sl = h[0], sh = h[1];
          while (rootI < order.length) {
            const m = order[rootI], c = s.make(m);
            const v = -s.search(depth - 1, -INF, exact ? INF : -alpha, 1);
            s.unmake(m, c, sl, sh);
            nv[rootI] = v; if (v > best) best = v; if (!exact && v > alpha) alpha = v; rootI++;
          }
          // finished a depth: rank the root moves by value (best first) for the next iteration
          const idxs = order.map((m, k) => k).sort((a, c) => nv[c] - nv[a] || a - c);
          order = idxs.map((k) => order[k]); vals = idxs.map((k) => nv[k]); doneDepths++;
          if (depth >= L.depth || total.nodes + s.nodes > L.budget || Math.abs(vals[0]) > MATE - 200) { finished = { move: finish() }; out = finished; break; }
          depth++; rootI = 0; nv = []; alpha = -INF; best = -INF;
        }
      } catch (e) { if (e !== ABORT) throw e; }
      total.nodes += s.nodes;
      return out;
    },
  };
}
// Run a thinker to the end (tests, self-play, puzzles).
export function chooseMove(g, level, rng) { const t = createThinker(g, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
