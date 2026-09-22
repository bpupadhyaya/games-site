// Tsume shogi (checkmate puzzles): the attacker (you, Sente, moving up) mates a lone king in 1 or 3 moves.
// Every puzzle in the bank (puzzles.js) was PROVEN by the solver below when it was made and has exactly one correct
// first move; the test suite re-proves the whole bank. The puzzle of the day is bank[day], the same for everybody.
import { BANK1, BANK3 } from './puzzles.js';
import { fromRows, make, unmake, gen, isLegalMove, inCheck, hasLegalMove, legalMoves, P, L, N, S, G, B, R, K, LETTER, mFrom, mTo } from './rules.js';

export const work = { nodes: 0, limit: Infinity };
export const ABORT = { abort: true };

// All legal checking moves for the side to move (used for the attacker).
export function checks(pos) {
  const buf = new Int32Array(1024), k = gen(pos, buf), out = [];
  for (let i = 0; i < k; i++) {
    const m = buf[i];
    if (!isLegalMove(pos, m)) continue;
    const cap = make(pos, m), c = inCheck(pos, pos.turn);
    unmake(pos, m, cap);
    if (c) out.push(m);
  }
  return out;
}
// Attacker (side 0) to move: is there a forced mate within n attacker moves?
export function mateIn(pos, n) {
  for (const m of checks(pos)) if (moveMates(pos, m, n)) return true;
  return false;
}
// After the attacker plays m, is mate forced within n attacker moves counting m?
export function moveMates(pos, m, n) {
  work.nodes++;
  if (work.nodes > work.limit) throw ABORT;
  const cap = make(pos, m);
  let ok = true;
  const replies = legalMoves(pos);
  if (replies.length === 0) { unmake(pos, m, cap); return true; }
  if (n <= 1) ok = false;
  else {
    for (const r of replies) {
      const c2 = make(pos, r);
      const win = mateIn(pos, n - 1);
      unmake(pos, r, c2);
      if (!win) { ok = false; break; }
    }
  }
  unmake(pos, m, cap);
  return ok;
}
export function mateMoves(pos, n) { return checks(pos).filter((m) => moveMates(pos, m, n)); }

// The defender's most stubborn reply: the one that delays mate longest. Deterministic.
export function bestDefence(pos) {
  const replies = legalMoves(pos);
  let best = replies[0], bestK = -1;
  for (const r of replies) {
    const c = make(pos, r);
    let k = 1;
    while (k < 5 && !mateIn(pos, k)) k++;
    unmake(pos, r, c);
    if (k > bestK) { bestK = k; best = r; }
  }
  return best;
}

export const weekday = (day) => (day + 4) % 7;     // 0 = Sunday (day 0 = Thursday 1970-01-01)
export const puzzleLength = (day) => { const w = weekday(day); return w === 5 || w === 6 || w === 0 ? 3 : 1; };
// The puzzle of the day: Monday-Thursday mate in 1, Friday-Sunday mate in 3; walks through the bank in order.
export function puzzleForDay(day) {
  const n = puzzleLength(day), week = Math.floor((day + 3) / 7), dow = (weekday(day) + 6) % 7;   // dow: Monday = 0
  const list = n === 1 ? BANK1 : BANK3, idx = n === 1 ? (week * 4 + dow) % list.length : (week * 3 + (dow - 4)) % list.length;
  return { ...list[idx], n, day, index: idx };
}
export function puzzlePos(pz) { return fromRows(pz.rows, pz.hand, 0); }
export { mFrom, mTo, hasLegalMove, LETTER, K, P, L, N, S, G };
