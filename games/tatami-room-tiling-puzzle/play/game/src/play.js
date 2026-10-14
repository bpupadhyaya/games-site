// A play session: the board plus undo / redo, the clock and the score keepers. No drawing, no input.
import { newBoard, placeTile, removeTile, fits, vertexConflicts, supplyLeft, solve, isSolved, badVertices, tileAt, transformPuzzle, parsePuzzle } from './tatami.js';

export const PAR_SECONDS = [0, 90, 200, 360, 600, 960];
export const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };

export function newSession({ puzzle, level, kind = 'free', day = 0, seed = 0 }) {
  const B = newBoard(puzzle);
  const sol = solve(B, { limit: 1 }).solutions[0] ?? [];
  return { puz: puzzle, B, sol, level, kind, day, seed, t: 0, errs: 0, hints: 0, moves: 0, undo: [], redo: [], done: false, counts: {} };
}
export function puzzleFor(str, sym) { return transformPuzzle(parsePuzzle(str), sym & 7); }

// Put a mat down. `block` refuses a placement that would make four corners meet. Returns { ok, id, bad, reason }.
export function putMat(P, a, b, { block = false, record = true } = {}) {
  const B = P.B;
  if (!fits(B, a, b)) return { ok: false, reason: 'fit' };
  const left = supplyLeft(B);
  if (a === b ? left.half <= 0 : left.full <= 0) return { ok: false, reason: a === b ? 'nohalf' : 'nofull' };
  const bad = vertexConflicts(B, a, b);
  if (bad.length && block) return { ok: false, reason: 'corner', bad };
  const id = placeTile(B, a, b, false);
  if (record) { P.undo.push({ op: 'add', a, b }); P.redo.length = 0; }
  P.moves += 1;
  if (bad.length) P.errs += 1;
  return { ok: true, id, bad };
}
export function pickUp(P, cell, { record = true } = {}) {
  const t = tileAt(P.B, cell);
  if (!t) return { ok: false, reason: 'empty' };
  if (t.given) return { ok: false, reason: 'given' };
  removeTile(P.B, t.id);
  if (record) { P.undo.push({ op: 'del', a: t.a, b: t.b }); P.redo.length = 0; }
  return { ok: true, a: t.a, b: t.b };
}
export function undo(P) {
  const o = P.undo.pop();
  if (!o) return false;
  if (o.op === 'add') { const t = tileAt(P.B, o.a); if (t && !t.given) removeTile(P.B, t.id); } else placeTile(P.B, o.a, o.b, false);
  P.redo.push(o);
  return true;
}
export function redo(P) {
  const o = P.redo.pop();
  if (!o) return false;
  if (o.op === 'add') placeTile(P.B, o.a, o.b, false); else { const t = tileAt(P.B, o.a); if (t && !t.given) removeTile(P.B, t.id); }
  P.undo.push(o);
  return true;
}
export function clearPlayer(P) {
  for (let i = 0; i < P.B.tiles.length; i++) { const t = P.B.tiles[i]; if (t && !t.given) removeTile(P.B, i); }
  P.undo.length = 0; P.redo.length = 0;
}
export const solvedNow = (P) => isSolved(P.B);
export const slips = (P) => badVertices(P.B).length;
export function starsFor(P) {
  let s = 3;
  if (P.hints > 0) s -= 1;
  if (P.errs > 3) s -= 1;
  if (P.hints > 3 || P.errs > 8) s -= 1;
  return Math.max(1, s);
}
