// The computer's brain. The whole game has only about 3,000 positions, so it is SOLVED exactly, once, when the game
// starts (a few milliseconds). Levels are how often each side deliberately slips. Everything is deterministic and
// clock-free. rules.js stays the readable authority; this file re-implements the same rules on plain arrays so a
// mistake in either shows up when they are compared (see design/ARCHITECTURE.md).
//   position: { h: hare point, d: [a, b, c] hound points sorted ascending, hm: hound moves made }
import { AX, STEPS, HOUND_STEPS, N, clone, applyMove, hareAt, houndsAt } from './rules.js';

export const INF = 99;
const id = (h, a, b, c) => ((h * 11 + a) * 11 + b) * 11 + c;
const past = (h, a, b, c) => AX[h] < AX[a] && AX[h] < AX[b] && AX[h] < AX[c];
const sort3 = (x, y, z) => (x < y ? (y < z ? [x, y, z] : x < z ? [x, z, y] : [z, x, y]) : x < z ? [y, x, z] : y < z ? [y, z, x] : [z, y, x]);

// dD[id]: hounds to move; the fewest hound moves that force a trap (INF = they cannot force it).
// tH[id]: hare to move; the fewest hare moves that force it past the hounds (INF = it cannot force it).
let dD = null, tH = null, states = null;
function solve() {
  if (dD) return;
  dD = new Int8Array(14641).fill(INF); tH = new Int8Array(14641).fill(INF); states = [];
  for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) for (let c = b + 1; c < N; c++) {
    if (h === a || h === b || h === c || a === b) continue;
    states.push([h, a, b, c]);
  }
  const hareMoves = (h, a, b, c) => STEPS[h].filter((j) => j !== a && j !== b && j !== c);
  const houndMoves = (h, a, b, c) => {
    const out = [], hs = [a, b, c];
    for (let i = 0; i < 3; i++) for (const j of HOUND_STEPS[hs[i]]) if (j !== h && j !== a && j !== b && j !== c) { const n = hs.slice(); n[i] = j; out.push(sort3(n[0], n[1], n[2])); }
    return out;
  };
  for (let round = 1; round <= 60; round++) {
    let changed = false;
    const nd = dD.slice(), nt = tH.slice();
    for (const [h, a, b, c] of states) {
      const k = id(h, a, b, c);
      if (!past(h, a, b, c)) {
        if (dD[k] === INF) {                                        // hounds to move
          let best = INF;
          for (const t of houndMoves(h, a, b, c)) {
            const hm = hareMoves(h, t[0], t[1], t[2]);
            let v;
            if (hm.length === 0) v = 1;
            else if (past(h, t[0], t[1], t[2])) continue;
            else { let mx = 0; for (const j of hm) { if (past(j, t[0], t[1], t[2])) { mx = INF; break; } const w = dD[id(j, t[0], t[1], t[2])]; if (w > mx) mx = w; if (mx >= INF) break; } v = mx >= INF ? INF : 1 + mx; }
            if (v < best) best = v;
          }
          if (best < INF) { nd[k] = best; changed = true; }
        }
        if (tH[k] === INF) {                                        // hare to move
          let best = INF;
          for (const j of hareMoves(h, a, b, c)) {
            if (past(j, a, b, c)) { best = 1; break; }
            const hs = houndMoves(j, a, b, c);
            let v;
            if (hs.length === 0) v = 1;
            else { let mx = 0; for (const t of hs) { if (past(j, t[0], t[1], t[2])) continue; if (hareMoves(j, t[0], t[1], t[2]).length === 0) { mx = INF; break; } const w = tH[id(j, t[0], t[1], t[2])]; if (w > mx) mx = w; if (mx >= INF) break; } v = mx >= INF ? INF : 1 + mx; }
            if (v < best) best = v;
          }
          if (best < INF) { nt[k] = best; changed = true; }
        }
      }
    }
    dD = nd; tH = nt;
    if (!changed) break;
  }
}
solve();

export const fromRules = (s) => { const d = houndsAt(s); return { h: hareAt(s), d, hm: s.hm }; };
export const trapIn = (s) => { const p = fromRules(s); return dD[id(p.h, ...p.d)]; };       // hounds to move: moves to force a trap
export const escapeIn = (s) => { const p = fromRules(s); return tH[id(p.h, ...p.d)]; };     // hare to move: moves to force an escape
export const isSolvedTables = () => ({ states: states.length, trapped: states.filter((q) => dD[id(...q)] < INF).length });

// Every legal move with a score. Hounds: smaller is better (moves to a forced trap after it). Hare: bigger is better
// (how long the hounds need after it; INF when they cannot force it). Moves are plain { from, to }.
export function scoredMoves(s) {
  const p = fromRules(s), out = [];
  if (s.turn === 'D') {
    for (let i = 0; i < 3; i++) for (const j of HOUND_STEPS[p.d[i]]) {
      if (s.board[j]) continue;
      const t = sort3(...p.d.map((x, k) => (k === i ? j : x)));
      const hm = STEPS[p.h].filter((q) => !t.includes(q));
      let v, esc = 0;
      if (hm.length === 0) v = 1;
      else if (past(p.h, ...t)) { v = INF; esc = 0; }
      else { let mx = 0; for (const q of hm) { if (past(q, ...t)) { mx = INF; break; } const w = dD[id(q, ...t)]; if (w > mx) mx = w; } v = mx >= INF ? INF : 1 + mx; esc = tH[id(p.h, ...t)]; }
      out.push({ from: p.d[i], to: j, v, esc, prog: t[0] * 0 + AX[j] - AX[p.d[i]] });
    }
  } else {
    for (const j of STEPS[p.h]) {
      if (s.board[j]) continue;
      let v, esc;
      if (past(j, ...p.d)) { v = INF; esc = 0; }
      else { v = dD[id(j, ...p.d)]; const hs = []; for (let i = 0; i < 3; i++) for (const q of HOUND_STEPS[p.d[i]]) if (q !== j && !p.d.includes(q)) hs.push(sort3(...p.d.map((x, k) => (k === i ? q : x)))); let mx = 0; for (const t of hs) { if (past(j, ...t)) continue; if (STEPS[j].every((r) => t.includes(r))) { mx = INF; break; } const w = tH[id(j, ...t)]; if (w > mx) mx = w; } esc = hs.length === 0 ? 0 : mx >= INF ? INF : 1 + mx; }
      out.push({ from: p.h, to: j, v, esc });
    }
  }
  return out;
}

// How fallible each level is: the chance that it plays a random legal move instead of its best one.
export const LEVELS = [
  { name: 'Easy', slip: 0.6 },
  { name: 'Medium', slip: 0.3 },
  { name: 'Hard', slip: 0.08 },
  { name: 'Master', slip: 0 },
];

// The best move for the side to move. Hounds: the fastest forced trap, else keep the hare from escaping and advance
// together. Hare: the longest survival; when it cannot be trapped, the fastest way out. Ties are broken by rng.
export function bestMove(s, rng) {
  const ms = scoredMoves(s); if (ms.length === 0) return null;
  // hounds: a lower rank is better; hare: a higher rank is better
  const rank = (m) => {
    if (s.turn === 'D') return m.v < INF ? -1000 + m.v : m.esc >= INF ? -m.prog * 0.5 : 500 - m.esc;
    return m.v >= INF ? 200 + (m.esc >= INF ? 0 : 100 - m.esc) : m.v;
  };
  let best = null, bs = null;
  for (const m of ms) {
    const r = s.turn === 'D' ? rank(m) : -rank(m);
    const jitter = rng ? rng.next() * 0.01 : 0;
    if (bs === null || r + jitter < bs) { bs = r + jitter; best = m; }
  }
  return { from: best.from, to: best.to };
}
export function chooseMove(s, level, rng) {
  const ms = scoredMoves(s); if (ms.length === 0) return null;
  const L = LEVELS[level] ?? LEVELS[1];
  if (ms.length > 1 && rng.next() < L.slip) { const m = ms[rng.int(ms.length)]; return { from: m.from, to: m.to }; }
  return bestMove(s, rng);
}
// The thinker interface the game loop uses (the search is instant here, but the loop is the same as elsewhere).
export function createThinker(s, level, rng) { return { step() { return { move: chooseMove(s, level, rng) }; } }; }

// Moves that keep a forced result within n more moves of the mover's side (puzzles). type: 'trap' | 'escape'.
export function forcingMoves(s, type, n) {
  const ms = scoredMoves(s), out = [];
  for (const m of ms) {
    if (type === 'trap' && m.v <= n) out.push({ from: m.from, to: m.to });
    if (type === 'escape') {
      const c = clone(s); applyMove(c, { from: m.from, to: m.to });
      const e = c.winner === 'H' ? 0 : c.winner === 'D' ? INF : escFor(c);
      if (e <= n - 1) out.push({ from: m.from, to: m.to });
    }
  }
  return out;
}
// hare has just moved: the hounds are to move; the hare's remaining forced-escape length from here (hounds delay).
export function escFor(c) {
  const p = fromRules(c), hs = [];
  for (let i = 0; i < 3; i++) for (const q of HOUND_STEPS[p.d[i]]) if (q !== p.h && !p.d.includes(q)) hs.push(sort3(...p.d.map((x, k) => (k === i ? q : x))));
  if (hs.length === 0) return 0;
  let mx = 0;
  for (const t of hs) { if (past(p.h, ...t)) continue; if (STEPS[p.h].every((r) => t.includes(r))) return INF; const w = tH[id(p.h, ...t)]; if (w > mx) mx = w; }
  return mx >= INF ? INF : mx;
}
export const allStates = () => states.map(([h, a, b, c]) => ({ h, d: [a, b, c] }));
export const tables = () => ({ dD, tH });
