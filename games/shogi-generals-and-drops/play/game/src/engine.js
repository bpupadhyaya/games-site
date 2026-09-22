// The computer's brain. Alpha-beta search written as an explicit-stack state machine so it can pause after any
// number of NODES (never time: the game must stay deterministic) and continue on the next frame. The play loop
// calls thinker.step(budget) once per tick until it returns a move, so the interface never freezes.
//
// Levels 1-3 search every root move with an open window and pick with noise (so they blunder like a learner would);
// levels 4-5 use iterative deepening with a narrowing window, killer moves, capture ordering, quiescence search and
// check extensions.
import { forSearch, gen, make, unmake, attacked, hasLegalMove, inCheck, base, K, P, mTo, isDrop, mFrom, mPromo, mDrop } from './rules.js';

export const LEVELS = [
  { name: 'Novice',     blurb: 'Sees one move ahead and often overlooks captures. A gentle first opponent.', depth: 1, nodes: 3000,   noise: 260, exact: true },
  { name: 'Apprentice', blurb: 'Sees two moves ahead. Takes free pieces, sometimes walks into a trade.',     depth: 2, nodes: 40000,  noise: 110, exact: true },
  { name: 'Club',       blurb: 'Sees three moves ahead and rarely leaves a piece hanging.',                  depth: 3, nodes: 120000, noise: 35,  exact: true },
  { name: 'Strong',     blurb: 'Searches four moves deep plus exchanges. Punishes mistakes and finds short mates.', depth: 4, nodes: 200000, noise: 0, exact: false },
  { name: 'Master',     blurb: 'Searches six to eight moves deep. Plans attacks, defends its king and drops pieces with purpose.', depth: 9, nodes: 450000, noise: 0, exact: false },
];

const INF = 100000, MATE = 30000;
const VAL = [0, 100, 430, 450, 640, 690, 890, 1040, 0, 420, 630, 640, 670, 0, 1150, 1330];
const HVAL = VAL.map((v) => Math.round(v * 1.08));

// Score from the point of view of the side to move.
function evaluate(p) {
  const n = p.n, b = p.b;
  let s = 0;
  const kr = [(p.kings[0] / n) | 0, (p.kings[1] / n) | 0], kc = [p.kings[0] % n, p.kings[1] % n];
  const hasK = [p.kings[0] >= 0, p.kings[1] >= 0];
  const guard = [0, 0];
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (!c) continue;
    const t = c & 15, side = c >> 4, r = (i / n) | 0, col = i - r * n;
    let v = VAL[t];
    if (t !== K) {
      const adv = side === 0 ? n - 1 - r : r;       // rows advanced from home
      if (t === P) v += adv * 4 + (adv >= n - 3 ? 14 : 0);
      else if (t === 3 || t === 4 || t === 6 || t === 7) v += adv * 2;
      if (hasK[1 - side] && t !== 5) { const d = Math.abs(r - kr[1 - side]) + Math.abs(col - kc[1 - side]); if (d < 8) v += (8 - d) * (t === 7 || t === 15 || t === 6 || t === 14 ? 3 : 2); }
      if (hasK[side] && (t === 4 || t === 5 || (t >= 9 && t <= 12))) { const d = Math.max(Math.abs(r - kr[side]), Math.abs(col - kc[side])); if (d <= 2) guard[side] += d === 1 ? 2 : 1; }
    } else {
      // king wants the corner side of its own camp early, not the middle of the board
      const home = side === 0 ? n - 1 - r : r;
      v += (home === 0 ? 30 : home === 1 ? 0 : -25 * (home - 1));
    }
    s += side === 0 ? v : -v;
  }
  s += (guard[0] - guard[1]) * 14;
  for (let t = 1; t <= 7; t++) s += (p.hand[0][t] - p.hand[1][t]) * HVAL[t];
  return p.turn === 0 ? s + 12 : -s + 12;
}

// Cheap static measure used by the hint text and tests.
export const staticScore = evaluate;

export function createThinker(pos, levelIndex, rng, opts = {}) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex))];
  const maxDepth = opts.depth ?? lv.depth, nodeCap = opts.nodes ?? lv.nodes;
  const p = forSearch(pos);
  const MAXP = 64, MAXM = 900;
  const mv = [], ms = [];
  for (let i = 0; i < MAXP; i++) { mv.push(new Int32Array(MAXM)); ms.push(new Int32Array(MAXM)); }
  const cnt = new Int32Array(MAXP), idx = new Int32Array(MAXP), al = new Int32Array(MAXP), be = new Int32Array(MAXP), best = new Int32Array(MAXP), bm = new Int32Array(MAXP), dl = new Int32Array(MAXP), capd = new Int32Array(MAXP), leg = new Int32Array(MAXP), fresh = new Uint8Array(MAXP), qn = new Uint8Array(MAXP), chk = new Uint8Array(MAXP);
  const killer = new Int32Array(MAXP * 2);
  const rootScores = new Map();
  let nodes = 0, ply = 0, depth = 0, returning = false, rv = 0, prevBest = -1, done = null, iterBest = null, iterScore = 0, started = false;

  function orderScores(k, pl) {
    const m = mv[pl], sc = ms[pl];
    for (let i = 0; i < k; i++) {
      const mvv = m[i];
      let s = 0;
      if (mvv === prevBest && pl === 0) s = 1e6;
      else if ((mvv & 127) === 127) s = 30 + ((mvv >> 15) & 15);
      else {
        const x = p.b[(mvv >> 7) & 127];
        const a = p.b[mvv & 127] & 15;
        if (x) s = 10000 + VAL[x & 15] * 10 - (VAL[a] >> 4);
        else if ((mvv >> 14) & 1) s = 6000 + VAL[a];
        else if (mvv === killer[pl * 2] || mvv === killer[pl * 2 + 1]) s = 5000;
        else s = 100 + (a === K ? -50 : 0);
      }
      sc[i] = s;
    }
  }
  function pawnDropMates(m) {
    // called AFTER make: the drop was a pawn; is it mate?
    return inCheck(p, p.turn) && !hasLegalMove(p);
  }

  function beginIteration(d) {
    depth = d; ply = 0; returning = false;
    al[0] = -INF; be[0] = INF; dl[0] = d; fresh[0] = 1; started = true; qn[0] = 0;
    rootScores.clear();
  }
  beginIteration(1);

  function finishIteration() {
    iterBest = bm[0]; iterScore = best[0];
    prevBest = iterBest;
    const over = depth >= maxDepth || nodes >= nodeCap || Math.abs(iterScore) > MATE - 200;
    if (over) { done = choose(); return; }
    beginIteration(depth + 1);
  }
  function choose() {
    if (lv.exact && !opts.noNoise && rootScores.size) {
      let bestM = iterBest, bestS = -INF;
      for (const [m, sc] of rootScores) {
        const v = sc + (lv.noise ? rng.range(-lv.noise, lv.noise) : 0);
        if (v > bestS) { bestS = v; bestM = m; }
      }
      return { move: bestM, score: iterScore, depth, nodes };
    }
    return { move: iterBest, score: iterScore, depth, nodes };
  }

  // One slice of work: returns null until finished, then { move, score, depth, nodes }.
  function step(budget = 2500) {
    if (done) return done;
    const stop = nodes + budget;
    for (;;) {
      if (nodes >= stop) return null;
      if (nodes > nodeCap * 2.5 && iterBest !== null) { done = choose(); return done; }
      if (returning) {
        if (ply === 0) { returning = false; finishIteration(); if (done) return done; continue; }
        ply--;
        const m = mv[ply][idx[ply] - 1];
        unmake(p, m, capd[ply]);
        const v = -rv;
        returning = false;
        if (ply === 0 && lv.exact && depth === lv.depth) rootScores.set(m, v);
        if (v > best[ply]) {
          best[ply] = v; bm[ply] = m;
          if (v > al[ply]) al[ply] = v;
          if (v >= be[ply]) {
            if (!(capd[ply]) && ((m >> 7) & 127) >= 0 && killer[ply * 2] !== m) { killer[ply * 2 + 1] = killer[ply * 2]; killer[ply * 2] = m; }
            returning = true; rv = v; continue;
          }
        }
        continue;
      }
      if (fresh[ply]) {
        fresh[ply] = 0;
        nodes++;
        if (ply >= MAXP - 3) { rv = evaluate(p); returning = true; continue; }
        const side = p.turn, inChk = inCheck(p, side);
        chk[ply] = inChk ? 1 : 0;
        const q = dl[ply] <= 0;
        leg[ply] = 0; idx[ply] = 0; bm[ply] = 0;
        if (q && !inChk) {
          const stand = evaluate(p);
          if (stand >= be[ply] || ply >= MAXP - 2 || qn[ply] >= 7) { rv = stand; returning = true; continue; }
          best[ply] = stand; if (stand > al[ply]) al[ply] = stand;
          cnt[ply] = gen(p, mv[ply], true);
        } else {
          best[ply] = -INF;
          cnt[ply] = gen(p, mv[ply], false);
        }
        orderScores(cnt[ply], ply);
        continue;
      }
      if (idx[ply] >= cnt[ply]) {
        // all moves tried
        const q = dl[ply] <= 0 && !chk[ply];
        if (!q && leg[ply] === 0) rv = -MATE + ply;
        else rv = best[ply];
        returning = true; continue;
      }
      // pick the best remaining move (selection, so cutoffs cost little)
      const m0 = mv[ply], s0 = ms[ply];
      let bi = idx[ply], bs = s0[bi];
      for (let j = bi + 1; j < cnt[ply]; j++) if (s0[j] > bs) { bs = s0[j]; bi = j; }
      const i0 = idx[ply];
      let t1 = m0[i0]; m0[i0] = m0[bi]; m0[bi] = t1; t1 = s0[i0]; s0[i0] = s0[bi]; s0[bi] = t1;
      const m = m0[i0]; idx[ply] = i0 + 1;
      const side = p.turn, cap = make(p, m);
      if (p.kings[side] >= 0 && attacked(p, p.kings[side], 1 - side)) { unmake(p, m, cap); continue; }
      if ((m & 127) === 127 && ((m >> 15) & 15) === P && pawnDropMates(m)) { unmake(p, m, cap); continue; }
      leg[ply]++; capd[ply] = cap;
      // descend
      const givesCheck = inCheck(p, p.turn);
      let nd = dl[ply] - 1;
      if (givesCheck && dl[ply] >= 1 && ply < depth + 2) nd = dl[ply];
      ply++;
      dl[ply] = nd; qn[ply] = nd <= 0 ? qn[ply - 1] + 1 : 0; fresh[ply] = 1;
      if (ply === 1 && lv.exact && depth === lv.depth) { al[ply] = -INF; be[ply] = INF; }
      else { al[ply] = -be[ply - 1]; be[ply] = -al[ply - 1]; }
    }
  }

  return { step, get nodes() { return nodes; }, get depth() { return depth; }, level: lv };
}

// Run to the end (tests, puzzle proofs, tools). Never call this in the play loop at levels 4-5.
export function chooseMove(pos, levelIndex, rng, opts) {
  const t = createThinker(pos, levelIndex, rng, opts);
  let r = null;
  while (!(r = t.step(20000)));
  return r;
}
export { mFrom, mTo, mPromo, mDrop, isDrop, base };
