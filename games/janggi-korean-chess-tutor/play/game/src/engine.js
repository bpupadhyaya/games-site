// The computer's brain. Alpha-beta negamax with a transposition table, iterative deepening, check extension,
// capture quiescence, killer/history move ordering. It uses rules.js for move generation, so it plays exactly the
// real rules, including passing, bikjang and the palace diagonals.
//
// It never blocks a frame: createThinker(...).step() searches at most STEP_NODES nodes and returns. When the node
// budget for a step runs out the search throws ABORT, and the next step re-walks the same path; every finished
// sub-tree is already in the transposition table, so little work is repeated. Work is counted in NODES, never in
// time, so the game stays deterministic.
import { genInto, attacked, kingSquare, positionKey, zIndex, ZOB_L, ZOB_H, SIDE_L, SIDE_H, keyNum, legalPacked, canPass, CHO, HAN, GENERAL, GUARD, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER, xOf, yOf, sqOf, PASS, RAYS, POINTS, HAN_BONUS, MIN_PLIES_TO_COUNT } from './rules.js';

export const STEP_NODES = 5000;      // nodes per step(): about 1 ms on a laptop, a few ms on a phone-class CPU
const MATE = 30000, INF = 32000, CLAIM = 25000;
const ABORT = { abort: true };
export { MIN_PLIES_TO_COUNT };

// One strength table. depth = deepest iteration; budget = total nodes the search may spend; noise = centipawns of
// random wobble added to each root move (weaker play); random = chance to simply play a random legal move.
export const LEVELS = [
  null,
  { name: 'Beginner', depth: 1, budget: 4000, noise: 260, random: 0.30, quiet: false },
  { name: 'Easy', depth: 2, budget: 9000, noise: 110, random: 0.09, quiet: true },
  { name: 'Medium', depth: 3, budget: 45000, noise: 30, random: 0, quiet: true },
  { name: 'Hard', depth: 5, budget: 200000, noise: 0, random: 0, quiet: true },
  { name: 'Master', depth: 12, budget: 900000, noise: 0, random: 0, quiet: true },
];
export const LEVEL_COUNT = 5;

// ---- evaluation ------------------------------------------------------------------------------------------------
// 1 counting point is about 50 centipawns (chariot 13, cannon 7, horse 5, elephant 3, guard 3, soldier 2).
const VAL = [0, 0, 160, 170, 260, 650, 340, 100];
const PST = []; for (let t = 1; t <= 7; t++) PST[t] = [new Int16Array(90), new Int16Array(90)];
for (let s = 0; s < 90; s++) {
  const x = xOf(s), y = yOf(s);                        // Cho's view: y = 9 is home, y = 0 is the enemy back rank
  const adv = 9 - y, dcx = Math.abs(x - 4), cx = 4 - dcx;
  const set = (t, v) => { PST[t][0][s] = v; PST[t][1][89 - s] = v; };   // 89 - s is the 180-degree turn, and the board is symmetric
  const inEnemyPalace = x >= 3 && x <= 5 && y <= 2;
  const palaceDiag = inEnemyPalace && ((x === 4 && y === 1) || x !== 4);
  set(GENERAL, y === 8 ? 0 : -10);
  set(GUARD, (x === 4 && y === 8) ? 6 : 0);
  set(ELEPHANT, cx * 4 + (adv >= 3 && adv <= 6 ? 6 : 0) - (dcx === 4 ? 10 : 0));
  set(HORSE, cx * 6 + Math.min(adv, 6) * 3 - (adv === 0 ? 10 : 0) - (dcx === 4 ? 16 : 0) + (inEnemyPalace ? 8 : 0));
  set(CHARIOT, Math.min(adv, 7) * 3 + (x === 4 || x === 3 || x === 5 ? 6 : 0) + (inEnemyPalace ? 14 : 0));
  set(CANNON, (x === 4 ? 14 : 0) + Math.min(adv, 6) * 2 + (dcx === 4 ? -6 : 0) + (inEnemyPalace && palaceDiag ? 10 : 0));
  set(SOLDIER, Math.max(0, adv - 3) * 9 + (inEnemyPalace ? 28 : 0) + (palaceDiag ? 10 : 0) + (adv >= 6 && x >= 2 && x <= 6 ? 8 : 0));
}
const TEMPO = 10;
function evaluate(b, side) {
  let v = 0, cho = 0, han = 0, choDef = 0, hanDef = 0, ch = 0, hn = 0;
  for (let s = 0; s < 90; s++) {
    const p = b[s]; if (p === 0) continue;
    if (p > 0) {
      v += VAL[p] + PST[p][0][s];
      if (p >= HORSE && p <= CANNON) cho++; else if (p === GUARD || p === ELEPHANT) choDef++;
      if (p === CHARIOT) { const rs = RAYS[s]; for (let d = 0; d < rs.length; d++) { const r = rs[d]; for (let k = 0; k < r.length && b[r[k]] === 0; k++) ch++; } }
    } else {
      v -= VAL[-p] + PST[-p][1][s];
      if (-p >= HORSE && -p <= CANNON) han++; else if (-p === GUARD || -p === ELEPHANT) hanDef++;
      if (p === -CHARIOT) { const rs = RAYS[s]; for (let d = 0; d < rs.length; d++) { const r = rs[d]; for (let k = 0; k < r.length && b[r[k]] === 0; k++) hn++; } }
    }
  }
  v += (ch - hn) * 2;                                    // chariot mobility
  v += (choDef - 3) * Math.min(han, 4) * 7 - (hanDef - 3) * Math.min(cho, 4) * 7;   // defenders matter while the enemy still has attackers
  return (side === CHO ? v : -v) + TEMPO;
}
function pointDiff(b, side) {                            // counting points, from `side`'s view (Han gets the 1.5 bonus)
  let c = 0, h = HAN_BONUS;
  for (let s = 0; s < 90; s++) { const p = b[s]; if (p > 0) c += POINTS[p]; else if (p < 0) h += POINTS[-p]; }
  return side === CHO ? c - h : h - c;
}

// ---- search state ----------------------------------------------------------------------------------------------
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
function makeSearcher() {
  const b = new Int8Array(90), ksq = new Int16Array(2);
  const ttKey = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE), ttMove = new Int16Array(TT_SIZE);
  const moves = []; for (let i = 0; i < 80; i++) moves.push(new Int32Array(200));
  const scores = []; for (let i = 0; i < 80; i++) scores.push(new Int32Array(200));
  const killers = new Int16Array(80 * 2), history = new Int32Array(2 * 90 * 90);
  const path = new Float64Array(80);                    // position keys along the current line (repetition = draw)
  let hl = 0, hh = 0, side = CHO, nodes = 0, limit = 0, useQ = true, histSet = null, plies = 0, plyBase = 0;
  const S = { b, nodes: () => nodes };

  const sideIdx = (s) => (s > 0 ? 0 : 1);
  function load(board, turn, keys, logLen) {
    hl = turn === HAN ? SIDE_L : 0; hh = turn === HAN ? SIDE_H : 0;
    for (let s = 0; s < 90; s++) { b[s] = board[s]; if (board[s]) { hl ^= ZOB_L[zIndex(board[s], s)]; hh ^= ZOB_H[zIndex(board[s], s)]; } }
    side = turn; ksq[0] = kingSquare(b, CHO); ksq[1] = kingSquare(b, HAN);
    histSet = new Set(keys || []); path.fill(0); path[0] = keyNum(hl, hh); plyBase = logLen | 0;
  }
  function make(m) {
    if (m === PASS) { hl ^= SIDE_L; hh ^= SIDE_H; side = -side; return 0; }
    const f = m & 127, t = m >> 7, p = b[f], c = b[t];
    hl ^= ZOB_L[zIndex(p, f)] ^ ZOB_L[zIndex(p, t)] ^ SIDE_L; hh ^= ZOB_H[zIndex(p, f)] ^ ZOB_H[zIndex(p, t)] ^ SIDE_H;
    if (c) { hl ^= ZOB_L[zIndex(c, t)]; hh ^= ZOB_H[zIndex(c, t)]; }
    b[t] = p; b[f] = 0;
    if (p === 1 || p === -1) ksq[p > 0 ? 0 : 1] = t;
    side = -side;
    return c;
  }
  function unmake(m, c, sl, sh) {
    hl = sl; hh = sh; side = -side;
    if (m === PASS) return;
    const f = m & 127, t = m >> 7, p = b[t];
    b[f] = p; b[t] = c;
    if (p === 1 || p === -1) ksq[p > 0 ? 0 : 1] = f;
  }
  const kingHit = (s) => attacked(b, ksq[s > 0 ? 0 : 1], -s);   // is side s's general attacked
  function facingNow() {
    const c = ksq[0], h = ksq[1]; if (xOf(c) !== xOf(h)) return false;
    const x = xOf(c); for (let y = yOf(h) + 1; y < yOf(c); y++) if (b[y * 9 + x] !== 0) return false;
    return true;
  }

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

  function quiesce(alpha, beta, ply, qd, recap) {
    if (++nodes > limit) throw ABORT;
    const stand = evaluate(b, side);
    if (stand >= beta || qd >= 6) return stand;
    if (stand > alpha) alpha = stand;
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, side, list, 0, true);
    score(list, sc, n, ply, 0, side);
    const me = side;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), t = m >> 7, sl = hl, sh = hh;
      const v = b[t], av = v > 0 ? v : -v; if (av === GENERAL) continue;
      if (qd >= 2 && t !== recap) continue;                  // deep in the capture chain only recaptures count
      if (stand + VAL[av] + 160 <= alpha) continue;          // even winning this piece cannot lift the score
      const c = make(m);
      if (kingHit(me)) { unmake(m, c, sl, sh); continue; }
      const val = -quiesce(-beta, -alpha, ply + 1, qd + 1, t);
      unmake(m, c, sl, sh);
      if (val >= beta) return val;
      if (val > alpha) alpha = val;
    }
    return alpha;
  }

  // prevPass: the move that led here was a pass (a second pass ends the game and the pieces are counted)
  function search(depth, alpha, beta, ply, prevPass) {
    if (++nodes > limit) throw ABORT;
    const key = keyNum(hl, hh);
    if (ply > 0) {
      for (let i = ply - 2; i >= 0; i -= 2) if (path[i] === key) return 0;
      if (histSet.has(key)) return 0;
    }
    path[ply] = key;
    const me = side, inChk = kingHit(me), bik = facingNow();
    if (inChk && ply < 30) depth++;
    if (depth <= 0) return useQ ? quiesce(alpha, beta, ply, 0, -1) : evaluate(b, side);
    if (ply >= 60) return evaluate(b, side);
    const slot = hl & TT_MASK;
    let ttm = 0;
    if (ttKey[slot] === hh && ttFlag[slot] !== 0) {
      ttm = ttMove[slot];
      if (ttDepth[slot] >= depth && !prevPass) {
        let s = ttScore[slot]; if (s > MATE - 100) s -= ply; else if (s < -MATE + 100) s += ply;
        const fl = ttFlag[slot];
        if (fl === 1) return s; if (fl === 2 && s >= beta) return s; if (fl === 3 && s <= alpha) return s;
      }
    }
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, me, list, 0, false);
    score(list, sc, n, ply, ttm, me);
    let best = -INF, bestMove = 0, legal = 0;
    if (bik) { best = 0; }                                // the side to move may call bikjang, a draw
    const a0 = alpha;
    if (bik && best > alpha) alpha = best;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), sl = hl, sh = hh;
      const c = make(m);
      if (kingHit(me) || (bik && facingNow())) { unmake(m, c, sl, sh); continue; }
      legal++;
      const val = -search(depth - 1, -beta, -alpha, ply + 1, false);
      unmake(m, c, sl, sh);
      if (val > best) { best = val; bestMove = m; if (val > alpha) { alpha = val; if (val >= beta) { if (!c) { const k = ply * 2; if (killers[k] !== m) { killers[k + 1] = killers[k]; killers[k] = m; } history[(sideIdx(me) * 90 + (m & 127)) * 90 + (m >> 7)] += depth * depth; } break; } } }
    }
    if (best < beta && !inChk && !bik) {                  // passing
      if (prevPass) {
        if (ply + plyBase >= MIN_PLIES_TO_COUNT) { const d = pointDiff(b, me); const val = d > 0 ? CLAIM - ply : -CLAIM + ply; legal++; if (val > best) { best = val; bestMove = PASS; if (val > alpha) alpha = val; } }
      } else if (depth >= 2) {
        const sl = hl, sh = hh; make(PASS); legal++;
        const val = -search(depth - 2, -beta, -alpha, ply + 1, true);
        unmake(PASS, 0, sl, sh);
        if (val > best) { best = val; bestMove = PASS; if (val > alpha) alpha = val; }
      }
    }
    if (legal === 0) return bik ? 0 : inChk ? -MATE + ply : evaluate(b, side);
    let store = best; if (store > MATE - 100) store += ply; else if (store < -MATE + 100) store -= ply;
    const fl = best <= a0 ? 3 : best >= beta ? 2 : 1;
    if (!prevPass && (ttFlag[slot] === 0 || ttDepth[slot] <= depth || ttKey[slot] !== hh)) { ttKey[slot] = hh; ttDepth[slot] = depth; ttFlag[slot] = fl; ttScore[slot] = Math.max(-32000, Math.min(32000, store)); ttMove[slot] = bestMove; }
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

// A thinker searches a little each time step() is called; it returns { move } (a { from, to } / { pass: true } or null) when done, { move: undefined } otherwise.
export function createThinker(g, level, rng) {
  const L = LEVELS[level] ?? LEVELS[3];
  const s = SHARED || (SHARED = makeSearcher());
  const rootBoard = g.board.slice(), turn = g.turn, keys = g.keys.slice(), logLen = g.log.length;
  const lastLog = g.log[g.log.length - 1], rootPrevPass = !!(lastLog && lastLog.pass);
  const real = legalPacked(rootBoard, turn);
  const rootMoves = real.slice();
  const passOk = canPass(g);
  if (passOk) rootMoves.push(PASS);
  const total = { nodes: 0 };
  let rootI = 0, nv = [], alpha = -INF, doneDepths = 0, depth = 1, vals = rootMoves.map(() => 0), order = rng.shuffle(rootMoves), done = rootMoves.length <= 1, started = false, best = -INF;
  const exact = L.noise > 0;
  let finished = null;

  const asMove = (m) => (m === PASS ? { pass: true, from: -1, to: -1 } : { from: m & 127, to: m >> 7 });
  const finish = () => {
    if (rootMoves.length === 0) return null;
    if (rootMoves.length === 1) return asMove(rootMoves[0]);
    if (real.length && rng.next() < L.random) return asMove(real[rng.int(real.length)]);
    if (!L.noise) return asMove(order[0]);             // exact best first; the other values are only bounds
    let pickI = 0, top = -Infinity;
    for (let i = 0; i < order.length; i++) {
      const v = vals[i] + (order[i] === PASS ? -80 : 0) + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.5;
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
        s.load(rootBoard, turn, keys, logLen);          // every step starts from a clean copy of the root
        for (;;) {
          // one iteration at `depth`, resumable at root-move granularity: finished root moves are never redone
          const h = s.hash(), sl = h[0], sh = h[1];
          while (rootI < order.length) {
            const m = order[rootI];
            let v;
            if (m === PASS) {
              if (rootPrevPass) { const d = pointDiff(rootBoard, turn); v = d > 0 ? CLAIM : -CLAIM; }
              else { s.make(PASS); v = -s.search(Math.max(0, depth - 2), -INF, exact ? INF : -alpha, 1, true); s.unmake(PASS, 0, sl, sh); }
            } else { const c = s.make(m); v = -s.search(depth - 1, -INF, exact ? INF : -alpha, 1, false); s.unmake(m, c, sl, sh); }
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
    // After finishing: the value (centipawns, mover's view) of the chosen first move, for the tutor's explanations.
    get score() { return vals[0]; },
  };
}
// Run a thinker to the end (tests, self-play).
export function chooseMove(g, level, rng) { const t = createThinker(g, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
