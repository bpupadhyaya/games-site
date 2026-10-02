// Tactical facts about a position (threats, forks, blocks). Shared by the opponents (ai.js), Think (explain.js)
// and the tutor lessons (lessons.js), so what Think says and what the opponent does always come from one place.
import { SPECS, legalMoves, applyMove, result, other } from './rules.js';

const asTurn = (st, p) => ({ mode: st.mode, cells: st.cells, turn: p, ply: st.ply });

// Moves player p could make right now (if it were p's turn) that win at once.
export function winMoves(st, p) {
  const s = asTurn(st, p), out = [];
  for (const mv of legalMoves(s)) { const r = result(applyMove(s, mv)); if (r && r.winner === p) out.push(mv); }
  return out;
}
export const winSquares = (st, p) => [...new Set(winMoves(st, p).map((m) => m.to))];

// Moves p could make now that complete a line (in Misère these lose at once).
export function lineMoves(st, p) {
  const s = asTurn(st, p), out = [];
  for (const mv of legalMoves(s)) { const r = result(applyMove(s, mv)); if (r && r.line) out.push(mv); }
  return out;
}

// Squares where p would, by moving there, leave two or more separate winning squares for the next turn: a fork.
export function forkMoves(st, p) {
  const s = asTurn(st, p), out = [];
  for (const mv of legalMoves(s)) {
    const c = applyMove(s, mv);
    if (result(c)) continue;
    if (winSquares(c, p).length >= 2) out.push(mv);
  }
  return out;
}

// How many lines run through each point: the classic reason the centre is strongest.
export const lineCount = (mode) => {
  const sp = SPECS[mode], n = new Array(sp.n).fill(0);
  for (const l of sp.lines) for (const i of l) n[i]++;
  return n;
};

export const markName = (p) => (p === 1 ? 'X' : 'O');
export const lineKind = (mode, line) => {
  if (!line) return '';
  if (mode === 'quad') return line[1] - line[0] === 1 && line[2] - line[0] === 4 ? 'four in a square' : 'four in a row';
  return 'three in a row';
};
export { other };
