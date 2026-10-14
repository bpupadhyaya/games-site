// One play session: the grid, undo/redo, counters. No drawing, no storage.
import { isSolved, wrongCells } from './engine.js';

export const PAR_SECONDS = { loshu: 90, shift3: 120, four: 240, pan4: 300, five: 420, pan5: 480 };
export const fmtTime = (t) => { const s = Math.max(0, Math.floor(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function newSession({ puz, kind = 'free', ref = '', variant = 'loshu', level = 0 }) {
  return { puz, grid: puz.givens.slice(), undo: [], redo: [], t: 0, errs: 0, hints: 0, moves: 0, kind, ref, variant, level, done: false, counts: {} };
}
export const isGiven = (P, i) => P.puz.givens[i] !== 0;
export const placedAt = (P, v) => P.grid.indexOf(v);
export const usedCount = (P) => P.grid.filter(Boolean).length;
export const total = (P) => P.puz.n * P.puz.n;

function apply(P, changes) { for (const c of changes) P.grid[c.cell] = c.to; }
function record(P, changes) {
  const ch = changes.filter((c) => c.from !== c.to);
  if (!ch.length) return false;
  apply(P, ch); P.undo.push(ch); P.redo = []; if (P.undo.length > 400) P.undo.shift(); P.moves += 1;
  return true;
}

// Put stone v on cell. Moves it if it is already on the board; a stone already on the cell goes back to the tray.
export function place(P, cell, v) {
  if (isGiven(P, cell) || P.done) return { ok: false };
  const ch = [], from = P.grid.indexOf(v), old = P.grid[cell];
  if (from === cell) return { ok: false };
  if (from >= 0) { if (isGiven(P, from)) return { ok: false }; ch.push({ cell: from, from: v, to: 0 }); }
  ch.push({ cell, from: old, to: v });
  record(P, ch);
  const bad = v !== P.puz.sol[cell];
  if (bad) P.errs += 1;
  return { ok: true, bad, replaced: old };
}
export function lift(P, cell) {
  if (isGiven(P, cell) || !P.grid[cell] || P.done) return { ok: false };
  const v = P.grid[cell];
  record(P, [{ cell, from: v, to: 0 }]);
  return { ok: true, value: v };
}
export function undoMove(P) { const ch = P.undo.pop(); if (!ch) return false; for (const c of ch) P.grid[c.cell] = c.from; P.redo.push(ch); return true; }
export function redoMove(P) { const ch = P.redo.pop(); if (!ch) return false; apply(P, ch); P.undo.push(ch); return true; }
export function resetStones(P) {
  const ch = [];
  P.grid.forEach((v, i) => { if (v && !isGiven(P, i)) ch.push({ cell: i, from: v, to: 0 }); });
  return record(P, ch);
}
export const solvedNow = (P) => isSolved(P.puz, P.grid);
export const wrongNow = (P) => wrongCells(P.puz, P.grid);
export function starsFor(P) { let s = 3; if (P.hints > 0) s -= 1; if (P.errs >= 4) s -= 1; return Math.max(1, s); }
