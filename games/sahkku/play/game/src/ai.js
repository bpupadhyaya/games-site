// The computer's brain. A turn is a sequence of dice uses, so the search walks every order of the dice and every choice of piece
// (memoised on position), and scores the position that is left: material, the king, and how likely each side is to be hit next roll.
import { legalMoves, applyMove, clone, menLeft, stackKey, reach, CAMP, DAWN, protectedMan, N } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', noise: 120, depth: 0, greedy: 0.4 },
  { name: 'Easy', noise: 40, depth: 1, greedy: 0.9 },
  { name: 'Strong', noise: 8, depth: 2, greedy: 1 },
  { name: 'Master', noise: 0, depth: 2, greedy: 1 },
];

// P[d]: chance that some subset of the four dice (Dawn counts 1 when stepping) adds up to exactly d.
const HIT = (() => {
  const P = new Array(13).fill(0);
  for (let o = 0; o < 256; o++) {
    const v = [o & 3, (o >> 2) & 3, (o >> 4) & 3, (o >> 6) & 3].map((x) => (x === DAWN ? 1 : x)), sums = new Set();
    for (let m = 1; m < 16; m++) { let s = 0; for (let i = 0; i < 4; i++) if (m & (1 << i)) s += v[i]; sums.add(s); }
    for (const s of sums) if (s <= 12) P[s] += 1 / 256;
  }
  return P;
})();
const WAKE_P = 1 - Math.pow(3 / 4, 4);

// Chance that player `by` lands on cell `c` with the next roll (independent attackers, best distance for each).
export function threat(g, c, by) {
  let miss = 1;
  const attackers = [];
  for (let x = 0; x < N * N; x++) if (g.men[by][x] > 0) attackers.push([x, false]);
  if (g.king.owner === by) attackers.push([g.king.cell, true]);
  for (const [x, k] of attackers) {
    if (x === c) continue;
    let best = 0;
    for (let d = 1; d <= 12; d++) if (HIT[d] > best && reach(x, d, k).has(c)) best = HIT[d];
    miss *= 1 - best;
  }
  if (g.sleep[by] > 0 && c === CAMP[by]) miss *= 1 - WAKE_P;
  return 1 - miss;
}

export function evaluate(g, me) {
  const opp = 1 - me;
  let v = 100 * (menLeft(g, me) - menLeft(g, opp));
  if (g.winner === me) return 1e5; if (g.winner === opp) return -1e5;
  for (let c = 0; c < N * N; c++) {
    if (g.men[me][c] > 0 && !protectedMan(g, c, me)) v -= 100 * threat(g, c, opp);
    if (g.men[opp][c] > 0 && !protectedMan(g, c, opp)) v += 38 * threat(g, c, me);
  }
  const kc = g.king.cell;
  if (g.king.owner === me) { v += 42; if (!(g.men[me][kc] > 0)) v -= 80 * threat(g, kc, opp); }
  else if (g.king.owner === opp) { v -= 42; if (!(g.men[opp][kc] > 0)) v += 40 * threat(g, kc, me); }
  else { v += 16 * threat(g, kc, me) - 30 * threat(g, kc, opp); }
  if (g.extra && g.turn === me) v += 15;
  return v;
}

// Best sequence for the side to move: returns the list of moves to play now, in order.
export function bestTurn(g0, level, rng, nodeCap = 5000) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], me = g0.turn;
  let nodes = 0;
  const memo = new Map();
  const noise = () => (lv.noise ? (rng.next() - 0.5) * 2 * lv.noise : 0);
  const key = (g) => `${stackKey(g)}|${g.turn}|${g.used.map((u, i) => (u ? 'x' : g.dice[i])).sort().join('')}|${g.phase}`;
  function search(g, d) {
    if (g.phase !== 'move' || g.turn !== me || g.winner >= 0) return { v: evaluate(g, me), seq: [] };
    const k = key(g);
    if (memo.has(k)) return memo.get(k);
    const ms = legalMoves(g);
    if (!ms.length) return { v: evaluate(g, me), seq: [] };
    let best = null;
    // captures first so a capped search still sees the good lines
    ms.sort((a, b) => (b.cap ? 2 : 0) + (b.flip ? 1 : 0) - ((a.cap ? 2 : 0) + (a.flip ? 1 : 0)));
    for (const m of ms) {
      if (nodes++ > nodeCap && best) break;
      const g2 = clone(g); applyMove(g2, m);
      const r = search(g2, d + 1), v = r.v;
      if (!best || v > best.v) best = { v, seq: [m, ...r.seq] };
    }
    memo.set(k, best);
    return best;
  }
  if (lv.depth === 0) {                       // Beginner: a capture when seen (sometimes), otherwise a random legal move
    const g = clone(g0), seq = [];
    while (g.phase === 'move' && g.turn === me) {
      const ms = legalMoves(g); if (!ms.length) break;
      const caps = ms.filter((m) => m.cap || m.flip);
      const m = caps.length && rng.next() < lv.greedy ? rng.pick(caps) : rng.pick(ms);
      seq.push(m); applyMove(g, m);
    }
    return seq;
  }
  if (lv.depth === 1) {                       // Easy: die by die, the move that leaves the best-looking position (with noise)
    const g = clone(g0), seq = [];
    while (g.phase === 'move' && g.turn === me) {
      const ms = legalMoves(g); if (!ms.length) break;
      let best = null;
      for (const m of ms) { const g2 = clone(g); applyMove(g2, m); const v = evaluate(g2, me) + noise() + (m.cap ? 60 : 0); if (!best || v > best.v) best = { v, m }; }
      seq.push(best.m); applyMove(g, best.m);
    }
    return seq;
  }
  // Strong / Master: the whole turn, every order
  const r = search(clone(g0), 0);
  if (lv.noise) {
    // Strong sometimes picks the second-best first move: look at each first move's value and add a little noise
    const ms = legalMoves(g0); let best = null;
    for (const m of ms) { const g2 = clone(g0); applyMove(g2, m); const rr = search(g2, 1), v = rr.v + noise(); if (!best || v > best.v) best = { v, seq: [m, ...rr.seq] }; }
    return (best || r).seq;
  }
  return r.seq;
}
