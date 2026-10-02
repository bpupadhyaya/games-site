// The rule engine for all four modes. Pure and deterministic. A state is { mode, cells, turn, ply }:
// cells[i] is 0 (empty), 1 (X, always moves first) or 2 (O). Every rule the Rules pages state lives here.
//
//   classic  3x3, place one mark a turn, three in a row wins; a full board is a draw.
//   terni    3x3, three pieces each: place all three, then slide one piece a turn along a line of the board
//            (rows, columns and the two diagonals) to an empty neighbouring point; three in a row wins; a player
//            who cannot move loses; the same position three times is a draw.
//   misere   3x3 like classic, but completing three in a row LOSES.
//   quad     4x4, place one mark a turn; four in a row or four in a 2x2 square wins; a full board is a draw.

export const MODE_IDS = ['classic', 'terni', 'misere', 'quad'];
export const MODE_NAMES = { classic: 'Classic 3x3', terni: 'Terni Lapilli', misere: 'Misère', quad: 'Quad 4x4' };

const L3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const L4 = [];
for (let r = 0; r < 4; r++) L4.push([0, 1, 2, 3].map((c) => r * 4 + c));
for (let c = 0; c < 4; c++) L4.push([0, 1, 2, 3].map((r) => r * 4 + c));
L4.push([0, 5, 10, 15], [3, 6, 9, 12]);
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) L4.push([r * 4 + c, r * 4 + c + 1, (r + 1) * 4 + c, (r + 1) * 4 + c + 1]);

// Neighbours along the lines of the 3x3 board (a step between two consecutive points of a line).
const ADJ3 = Array.from({ length: 9 }, () => []);
for (const l of L3) for (let i = 0; i + 1 < l.length; i++) { ADJ3[l[i]].push(l[i + 1]); ADJ3[l[i + 1]].push(l[i]); }

export const SPECS = {
  classic: { n: 9, size: 3, lines: L3, misere: false, slide: false },
  terni: { n: 9, size: 3, lines: L3, misere: false, slide: true, pieces: 3, adj: ADJ3 },
  misere: { n: 9, size: 3, lines: L3, misere: true, slide: false },
  quad: { n: 16, size: 4, lines: L4, misere: false, slide: false },
};
export const specOf = (mode) => SPECS[mode];

export const startState = (mode) => ({ mode, cells: new Array(SPECS[mode].n).fill(0), turn: 1, ply: 0 });
export const cloneState = (st) => ({ mode: st.mode, cells: st.cells.slice(), turn: st.turn, ply: st.ply });
export const keyOf = (st) => `${st.cells.join('')}${st.turn}`;
export const countOf = (st, p) => { let n = 0; for (const c of st.cells) if (c === p) n++; return n; };
export const other = (p) => 3 - p;

export function legalMoves(st) {
  const sp = SPECS[st.mode], out = [];
  if (sp.slide && countOf(st, st.turn) >= sp.pieces) {
    for (let i = 0; i < sp.n; i++) if (st.cells[i] === st.turn) for (const j of sp.adj[i]) if (!st.cells[j]) out.push({ from: i, to: j });
  } else {
    for (let i = 0; i < sp.n; i++) if (!st.cells[i]) out.push({ from: -1, to: i });
  }
  return out;
}
export const isPlacing = (st) => { const sp = SPECS[st.mode]; return !sp.slide || countOf(st, st.turn) < sp.pieces; };

export function applyMove(st, mv) {
  const cells = st.cells.slice();
  if (mv.from >= 0) cells[mv.from] = 0;
  cells[mv.to] = st.turn;
  return { mode: st.mode, cells, turn: 3 - st.turn, ply: st.ply + 1 };
}

export function lineOf(st, p) {
  for (const l of SPECS[st.mode].lines) if (l.every((i) => st.cells[i] === p)) return l;
  return null;
}

// null while the game goes on; otherwise { winner: 1|2|0, line, why } where why is 'line' | 'misere' | 'blocked' | 'full'.
export function result(st) {
  if (!st.ply) return null;
  const sp = SPECS[st.mode], last = 3 - st.turn;
  const line = lineOf(st, last);
  if (line) return sp.misere ? { winner: st.turn, line, why: 'misere' } : { winner: last, line, why: 'line' };
  if (sp.slide) { if (!legalMoves(st).length) return { winner: last, line: null, why: 'blocked' }; return null; }
  if (st.cells.every((c) => c)) return { winner: 0, line: null, why: 'full' };
  return null;
}

// A state seen from the same player again with the same board: used for the repetition draw in terni lapilli.
export const parse = (mode, rows, turn = 1) => {
  const cells = rows.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0));
  return { mode, cells, turn, ply: cells.filter((c) => c).length || 1 };
};

export const coordOf = (mode, i) => { const s = SPECS[mode].size; return [Math.floor(i / s), i % s]; };
const COLS = 'abcd';
export const nameOf = (mode, i) => { const [r, c] = coordOf(mode, i); return `${COLS[c]}${r + 1}`; };
export const wordsOf = (mode, i) => {
  const s = SPECS[mode].size, [r, c] = coordOf(mode, i);
  if (s === 3) {
    if (i === 4) return 'the centre';
    if (i % 2 === 0) return `the ${r === 0 ? 'top' : 'bottom'}-${c === 0 ? 'left' : 'right'} corner`;
    return `the ${r === 0 ? 'top' : r === 2 ? 'bottom' : c === 0 ? 'left' : 'right'} edge`;
  }
  return `row ${r + 1}, column ${c + 1}`;
};
