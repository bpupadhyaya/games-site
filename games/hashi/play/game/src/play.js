// One puzzle session: the player's bridges, undo/redo, mistakes and hints. Pure data + functions
// (the session is plain JSON so it can be saved and so the game state stays serialisable).
import { build, solve, humanSolve, remAll, crossedBy, applyStep, isSolved, islandStatus } from './hashi.js';

export function newSession({ str, kind = 'free', level, seed = 0, day = 0 }) {
  const P = build(str), sol = solve(P);
  return {
    str, sol, br: new Array(P.E).fill(0), cap: new Array(P.E).fill(2),
    level, kind, seed, day, t: 0, errs: 0, hints: 0, moves: 0, undo: [], redo: [], done: false, counts: humanSolve(P).counts,
  };
}

export const puzzleOf = (S) => build(S.str);
export const solved = (S) => isSolved(puzzleOf(S), S.br);
export const bridgesPlaced = (S) => S.br.reduce((n, v) => n + v, 0);
export const bridgesTotal = (S) => S.sol.reduce((n, v) => n + v, 0);
export const wrong = (S, e) => S.br[e] > S.sol[e];
export const wrongEdges = (S) => { const out = []; for (let e = 0; e < S.br.length; e++) if (wrong(S, e)) out.push(e); return out; };
export const remainingAt = (S, i) => remAll(puzzleOf(S), S.br)[i];
export const islandsDone = (S) => { const P = puzzleOf(S); let n = 0; for (let i = 0; i < P.n; i++) if (islandStatus(P, S.br, i) === 'full') n += 1; return n; };

const push = (S, rec) => { S.undo.push(rec); if (S.undo.length > 400) S.undo.shift(); S.redo.length = 0; };
// A record is [[edge, oldBridges], ...]; applying it swaps the stored values with the current ones.
const swap = (S, rec) => rec.map(([e, v]) => { const cur = [e, S.br[e]]; S.br[e] = v; return cur; });

// Islands that are exactly full after a change on edge e (for the little chime).
function filledBy(S, e) {
  const P = puzzleOf(S), out = [];
  for (const i of [P.ea[e], P.eb[e]]) if (islandStatus(P, S.br, i) === 'full') out.push(i);
  return out;
}

// Cycle a lane: none -> single -> double -> none. Refused when a bridge already crosses its path.
export function cycle(S, e) {
  if (S.done) return { ok: false, why: 'done' };
  const P = puzzleOf(S), by = crossedBy(P, S.br, e);
  if (by >= 0) return { ok: false, why: 'blocked', by };
  const old = S.br[e], next = (old + 1) % 3;
  push(S, [[e, old]]);
  S.br[e] = next; S.moves += 1;
  const bad = next > old && next > S.sol[e];
  if (bad) S.errs += 1;
  return { ok: true, kind: next === 0 ? 'clear' : 'bridge', bad, from: old, to: next, filled: next > old ? filledBy(S, e) : [] };
}
// Set a lane directly (used by hints and by the keyboard).
export function setLane(S, e, to) {
  if (S.br[e] === to) return { ok: false };
  push(S, [[e, S.br[e]]]);
  S.br[e] = to; S.moves += 1;
  return { ok: true, kind: to ? 'bridge' : 'clear', filled: filledBy(S, e) };
}
// Remove every bridge on one island's lanes.
export function clearIsland(S, i) {
  const P = puzzleOf(S), rec = [];
  for (const e of P.inc[i]) if (S.br[e]) { rec.push([e, S.br[e]]); S.br[e] = 0; }
  if (!rec.length) return { ok: false, why: 'empty' };
  push(S, rec); S.moves += 1;
  return { ok: true, kind: 'clear' };
}
export function clearAll(S) {
  const rec = [];
  for (let e = 0; e < S.br.length; e++) if (S.br[e]) { rec.push([e, S.br[e]]); S.br[e] = 0; }
  if (rec.length) push(S, rec);
  return rec.length > 0;
}
export function undo(S) { const rec = S.undo.pop(); if (!rec) return false; S.redo.push(swap(S, rec)); return true; }
export function redo(S) { const rec = S.redo.pop(); if (!rec) return false; S.undo.push(swap(S, rec)); return true; }

// Apply a solver step on the player's behalf (the hint's "Apply"): bridges, or a remembered limit on a lane.
export function applyHint(S, step) {
  const rec = [];
  if (step.place) for (const p of step.place) if (S.br[p.e] !== p.to) rec.push([p.e, S.br[p.e]]);
  applyStep(puzzleOf(S), S, step);
  if (rec.length) { push(S, rec); S.moves += 1; }
  return { ok: true, kind: step.place ? 'bridge' : 'limit', filled: step.place ? step.place.flatMap((p) => filledBy(S, p.e)) : [] };
}

export const PAR_SECONDS = [0, 120, 240, 420, 660, 900];
export function starsFor(S) {
  let s = 3;
  if (S.hints > 3 || S.errs > 3) s -= 1;
  if (S.t > PAR_SECONDS[S.level] * 1.6) s -= 1;
  if (S.hints > 8 || S.errs > 8) s -= 1;
  return Math.max(1, s);
}
export const fmtTime = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
