// The board a player works on: cell marks, undo/redo, line-complete flags. Pure data and functions, no drawing.
import { lineDone, isSolved, FILLED, CROSSED, UNKNOWN } from './solver.js';

export const TOOL_FILL = 'fill', TOOL_CROSS = 'cross', TOOL_MOVE = 'move';

export function newBoard(puz) {
  const b = { cells: new Uint8Array(puz.w * puz.h), undo: [], redo: [], mistakes: 0, hints: 0, doneR: [], doneC: [], solved: false };
  refresh(puz, b);
  return b;
}

export function refresh(puz, b) {
  const done = (axis, k) => {
    const clue = axis === 'row' ? puz.rows[k] : puz.cols[k];
    if (clue.length) return lineDone(puz, b.cells, axis, k) ? 1 : 0;
    // a line with no clue is finished once every one of its cells is marked
    const n = axis === 'row' ? puz.w : puz.h;
    for (let i = 0; i < n; i++) if (b.cells[axis === 'row' ? k * puz.w + i : i * puz.w + k] === UNKNOWN) return 0;
    return 1;
  };
  b.doneR = Array.from({ length: puz.h }, (_, r) => done('row', r));
  b.doneC = Array.from({ length: puz.w }, (_, c) => done('col', c));
}

export const encode = (cells) => Array.from(cells).join('');
export function decode(puz, str) {
  const cells = new Uint8Array(puz.w * puz.h);
  if (typeof str !== 'string' || str.length !== cells.length) return null;
  for (let i = 0; i < cells.length; i++) { const v = str.charCodeAt(i) - 48; if (v < 0 || v > 2) return null; cells[i] = v; }
  return cells;
}

export const isDone = (puz, b) => isSolved(puz, b.cells);
export const filledCount = (b) => { let n = 0; for (const v of b.cells) if (v === FILLED) n++; return n; };

// The mark a stroke paints, given the tool and the state of the cell where the finger went down.
export function strokeValue(tool, from) {
  if (tool === TOOL_CROSS) return from === CROSSED ? UNKNOWN : CROSSED;
  return from === FILLED ? UNKNOWN : FILLED;
}

// A mark is wrong when it contradicts the hidden picture.
export const wrongMark = (puz, i, v) => (v === FILLED && puz.sol[i] === 0) || (v === CROSSED && puz.sol[i] === 1);

// Applies a list of [index, old, new] entries going forwards (dir 1) or backwards (dir -1).
export function applyChanges(b, changes, dir) {
  for (const [i, a, z] of changes) b.cells[i] = dir > 0 ? z : a;
}

export function commit(puz, b, base, changes) {
  if (!changes.length) return false;
  b.undo.push(changes);
  if (b.undo.length > 400) b.undo.shift();
  b.redo.length = 0;
  refresh(puz, b);
  return true;
}
export function undo(puz, b) {
  const ch = b.undo.pop();
  if (!ch) return null;
  applyChanges(b, ch, -1);
  b.redo.push(ch);
  refresh(puz, b);
  return ch;
}
export function redo(puz, b) {
  const ch = b.redo.pop();
  if (!ch) return null;
  applyChanges(b, ch, 1);
  b.undo.push(ch);
  refresh(puz, b);
  return ch;
}
