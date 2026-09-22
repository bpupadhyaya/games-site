// The game is small enough to be SOLVED: every one of the 1,260 positions (630 stone layouts x 2 sides to move)
// is labelled by retrograde analysis as won, lost or drawn for the side to move, with the number of plies.
// The computer levels and the puzzles are all read from this table. Built once, in a few milliseconds.
import { legalMoves, other, C } from './rules.js';

const N = 3 ** 9 * 2;
export const enc = (b, t) => { let k = 0; for (let i = 0; i < 9; i++) k = k * 3 + b[i]; return k * 2 + (t - 1); };
const dec = (k) => { const t = (k & 1) + 1; k >>= 1; const b = new Array(9); for (let i = 8; i >= 0; i--) { b[i] = k % 3; k = Math.floor(k / 3); } return [b, t]; };
const after = (b, t, m) => { const n = b.slice(); n[m.to] = t; n[m.from] = 0; return enc(n, other(t)); };

let T = null;
export function table() {
  if (T) return T;
  const res = new Int8Array(N), dep = new Int16Array(N), valid = [], succ = new Map();
  for (let k = 0; k < N; k++) { const [b] = dec(k); let a = 0, c = 0; for (const x of b) { if (x === 1) a++; else if (x === 2) c++; } if (a === 4 && c === 4) valid.push(k); }
  for (const k of valid) { const [b, t] = dec(k); succ.set(k, legalMoves(b, t).map((m) => after(b, t, m))); }
  for (const k of valid) if (!succ.get(k).length) res[k] = -1;
  for (let d = 1, ch = true; ch; d++) {
    ch = false; const upd = [];
    for (const k of valid) {
      if (res[k]) continue;
      const s = succ.get(k);
      if (s.some((x) => res[x] === -1 && dep[x] < d)) upd.push([k, 1]);
      else if (s.every((x) => res[x] === 1 && dep[x] < d)) upd.push([k, -1]);
    }
    for (const [k, r] of upd) { res[k] = r; dep[k] = d; ch = true; }
  }
  T = { res, dep, valid };
  return T;
}
// { r: 1 the side to move wins, -1 loses, 0 draws with best play; d: plies to the end }
export function verdict(b, t) { const { res, dep } = table(), k = enc(b, t); return { r: res[k], d: res[k] ? dep[k] : 0 }; }

// Every legal move with what it leads to, from the mover's point of view: { m, v: 1 win / -1 loss / 0 draw, p: plies }.
export function rate(b, t) {
  const { res, dep } = table();
  return legalMoves(b, t).map((m) => { const k = after(b, t, m); return { m, v: -res[k], p: res[k] ? dep[k] + 1 : 0, k }; });
}
// Positions won for the side to move, for the puzzles: [{ board, turn, plies }]
export function wonPositions() {
  const { res, dep, valid } = table(), out = [];
  for (const k of valid) if (res[k] === 1) { const [board, turn] = dec(k); out.push({ board, turn, plies: dep[k] }); }
  return out;
}
export { dec };
