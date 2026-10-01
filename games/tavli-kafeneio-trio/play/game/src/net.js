// A small neural evaluation for Portes (the standard backgammon-style game), trained by self-play (temporal-difference learning).
// Input: the position seen from one side's chair (that side has just moved). Output: three chances for that side: win, win by
// "mars" (the loser has borne off nothing) and lose by mars. Equity = (2 win - 1) + marsWin - marsLoss, in games won minus lost.
import { top, idxAt, pips, isOver, resultValue, winner } from './rules.js';

export const NIN = 198;
const IDX = new Int16Array(NIN), VAL = new Float32Array(NIN);

// fill IDX/VAL with the active inputs for `me`; returns how many
export function encode(s, me) {
  const op = 1 - me, v = s.v;
  let n = 0, myMax = 0, opMax = 0;
  for (let k = 1; k <= 24; k++) {
    const a = top(s, me, idxAt(v, me, k)), b = top(s, op, idxAt(v, op, k));
    if (a > 0) {
      if (k > myMax) myMax = k;
      const base = (k - 1) * 4;
      IDX[n] = base; VAL[n++] = 1;
      if (a >= 2) { IDX[n] = base + 1; VAL[n++] = 1; }
      if (a >= 3) { IDX[n] = base + 2; VAL[n++] = 1; }
      if (a > 3) { IDX[n] = base + 3; VAL[n++] = (a - 3) / 2; }
    }
    if (b > 0) {
      if (k > opMax) opMax = k;
      const base = 96 + (k - 1) * 4;
      IDX[n] = base; VAL[n++] = 1;
      if (b >= 2) { IDX[n] = base + 1; VAL[n++] = 1; }
      if (b >= 3) { IDX[n] = base + 2; VAL[n++] = 1; }
      if (b > 3) { IDX[n] = base + 3; VAL[n++] = (b - 3) / 2; }
    }
  }
  if (s.bar[me]) { IDX[n] = 192; VAL[n++] = s.bar[me] / 2; }
  if (s.bar[op]) { IDX[n] = 193; VAL[n++] = s.bar[op] / 2; }
  if (s.off[me]) { IDX[n] = 194; VAL[n++] = s.off[me] / 15; }
  if (s.off[op]) { IDX[n] = 195; VAL[n++] = s.off[op] / 15; }
  IDX[n] = 196; VAL[n++] = (pips(s, op) - pips(s, me)) / 100;
  // contact: one of my checkers still has to pass one of the opponent's (my distance k vs the opponent's distance 25 - k)
  const contact = s.bar[me] > 0 || s.bar[op] > 0 || myMax + opMax > 24;
  if (contact) { IDX[n] = 197; VAL[n++] = 1; }
  return n;
}

const sig = (x) => 1 / (1 + Math.exp(-x));
// net = { H, w1: Float32Array(NIN*H), b1, w2: Float32Array(3*H), b2 }
export function forward(net, n, hid, out, idx = IDX, val = VAL) {
  const H = net.H, w1 = net.w1;
  for (let h = 0; h < H; h++) hid[h] = net.b1[h];
  for (let j = 0; j < n; j++) { const o = idx[j] * H, x = val[j]; for (let h = 0; h < H; h++) hid[h] += w1[o + h] * x; }
  for (let h = 0; h < H; h++) hid[h] = Math.tanh(hid[h]);
  for (let k = 0; k < 3; k++) { let a = net.b2[k]; for (let h = 0; h < H; h++) a += net.w2[k * H + h] * hid[h]; out[k] = sig(a); }
}
export const inputs = () => ({ IDX, VAL });

const HID = new Float32Array(256), OUT = new Float32Array(3);
export const equityOf = (o) => 2 * o[0] - 1 + o[1] - o[2];
// equity for `me` in a position where the opponent is about to move (me has just moved)
export function netEquity(net, s, me) {
  if (isOver(s)) { const w = winner(s); const r = resultValue(s, w); return w === me ? r : -r; }
  const n = encode(s, me);
  forward(net, n, HID, OUT);
  return equityOf(OUT);
}
