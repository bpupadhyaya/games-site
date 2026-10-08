// One puzzle session: the grid, the player's pencil marks, undo/redo, mistakes and hints. Pure data + functions
// (the session is plain JSON so it can be saved and so the game state stays serialisable).
import { PEERS, HOUSES, bit, boxOf, colOf, rowOf, solveGrid, gradeOf } from './sudoku.js';

export function newSession({ givens, kind = 'free', level, seed = 0, day = 0 }) {
  const sol = solveGrid(givens);
  return {
    givens: givens.slice(), sol, v: givens.slice(), notes: new Array(81).fill(0), elim: new Array(81).fill(0),
    level, kind, seed, day, t: 0, errs: 0, hints: 0, moves: 0, undo: [], redo: [], done: false, counts: gradeOf(givens)?.counts ?? {},
  };
}

export const isGiven = (P, i) => P.givens[i] !== 0;
export const filled = (P) => P.v.reduce((n, d) => n + (d ? 1 : 0), 0);
export const remaining = (P, d) => 9 - P.v.reduce((n, x) => n + (x === d ? 1 : 0), 0);
export const conflict = (P, i) => !!P.v[i] && PEERS[i].some((p) => P.v[p] === P.v[i]);
export const wrong = (P, i) => !!P.v[i] && !P.givens[i] && P.v[i] !== P.sol[i];
export const solved = (P) => P.v.every((d, i) => d === P.sol[i]);
export const wrongCells = (P) => { const out = []; for (let i = 0; i < 81; i++) if (wrong(P, i)) out.push(i); return out; };

const push = (P, rec) => { P.undo.push(rec); if (P.undo.length > 400) P.undo.shift(); P.redo.length = 0; };
// A record is [[cell, oldValue, oldNotes], ...]; applying it swaps the stored values with the current ones.
const swap = (P, rec) => rec.map(([c, v, n]) => { const cur = [c, P.v[c], P.notes[c]]; P.v[c] = v; P.notes[c] = n; return cur; });

// Place digit d in cell i (or toggle a pencil mark in notes mode). Returns { ok, why, houses } for the caller's effects.
export function enter(P, i, d, { notesMode = false, autoClear = true } = {}) {
  if (P.done || isGiven(P, i)) return { ok: false, why: 'given' };
  if (notesMode) {
    if (P.v[i]) return { ok: false, why: 'filled' };
    push(P, [[i, P.v[i], P.notes[i]]]);
    P.notes[i] ^= bit(d); P.moves += 1;
    return { ok: true, kind: 'note' };
  }
  if (P.v[i] === d) return erase(P, i);
  const rec = [[i, P.v[i], P.notes[i]]];
  P.v[i] = d; P.notes[i] = 0;
  if (autoClear) for (const p of PEERS[i]) if (!P.v[p] && P.notes[p] & bit(d)) { rec.push([p, P.v[p], P.notes[p]]); P.notes[p] &= ~bit(d); }
  push(P, rec); P.moves += 1;
  const bad = d !== P.sol[i];
  if (bad) P.errs += 1;
  return { ok: true, kind: 'digit', bad, houses: completedHouses(P, i) };
}
export function erase(P, i) {
  if (P.done || isGiven(P, i) || (!P.v[i] && !P.notes[i])) return { ok: false, why: 'empty' };
  push(P, [[i, P.v[i], P.notes[i]]]);
  P.v[i] = 0; P.notes[i] = 0; P.moves += 1;
  return { ok: true, kind: 'erase' };
}
export function undo(P) { const rec = P.undo.pop(); if (!rec) return false; P.redo.push(swap(P, rec)); return true; }
export function redo(P) { const rec = P.redo.pop(); if (!rec) return false; P.undo.push(swap(P, rec)); return true; }

// Houses (0..26) that the move at cell i has just completed correctly.
function completedHouses(P, i) {
  const out = [];
  for (const h of [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]) if (HOUSES[h].every((c) => P.v[c] && P.v[c] === P.sol[c])) out.push(h);
  return out;
}

// Fill every empty cell's notes with the digits still logically possible (grid digits and hint-confirmed eliminations only).
export function fillNotes(P, S) {
  const rec = [];
  for (let i = 0; i < 81; i++) if (!P.v[i] && P.notes[i] !== S.c[i]) { rec.push([i, P.v[i], P.notes[i]]); P.notes[i] = S.c[i]; }
  if (rec.length) push(P, rec);
  return rec.length > 0;
}

// Apply a solver step on the player's behalf (the hint's "Apply"): a digit, or removal of candidates.
export function applyHint(P, st) {
  if (st.place) {
    const r = enter(P, st.place.cell, st.place.digit, { notesMode: false, autoClear: true });
    P.errs -= r.bad ? 1 : 0;
    return r;
  }
  const rec = [];
  for (const e of st.elim) {
    P.elim[e.cell] |= e.mask;
    if (P.notes[e.cell] & e.mask) { rec.push([e.cell, P.v[e.cell], P.notes[e.cell]]); P.notes[e.cell] &= ~e.mask; }
  }
  if (rec.length) push(P, rec);
  return { ok: true, kind: 'elim' };
}

export const PAR_SECONDS = [0, 360, 600, 900, 1200, 1800];
export function starsFor(P) {
  let s = 3;
  if (P.hints > 3 || P.errs > 3) s -= 1;
  if (P.t > PAR_SECONDS[P.level] * 1.6) s -= 1;
  if (P.hints > 8 || P.errs > 8) s -= 1;
  return Math.max(1, s);
}
export const fmtTime = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
