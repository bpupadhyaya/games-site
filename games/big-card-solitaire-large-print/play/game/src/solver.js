// Winnable-deal generator, and (for Auto Play) the exact solution line it finds along the way.
//
// HONESTY NOTE (see also STATUS.md): `isLikelyWinnable`/`solveFromBoard` are a bounded HEURISTIC
// search, not a perfect/exhaustive Klondike solver. A real solver would need a much larger search
// (Klondike solvability is a hard search problem even with draw-1 and unlimited redeals). What this
// does instead, per the prototype's brief:
//   1. Always send a card to a foundation when it's safe to do so (greedy).
//   2. Otherwise search a bounded number of tableau-unstacking / stock-cycling move sequences,
//      preferring moves that reveal a face-down card, with a hard node budget and a cap on how
//      many times the stock may be recycled.
//   3. If the budget runs out before a win is found, that is treated as "could not confirm" —
//      NOT as "proven unsolvable". The caller (generateWinnableDeal) then deals a different
//      shuffle from the same rng stream and tries again, up to `maxAttempts`.
//   4. If every attempt fails to confirm, the LAST attempted shuffle is dealt anyway (never
//      hangs), and the result's `verified` flag is set to false so this is visible/testable
//      rather than silently claimed as guaranteed-winnable.
//
// This means: every deal the player sees was independently checked and, in the common case,
// confirmed winnable by actually finding a full solution line. It does not mean every deal is
// mathematically guaranteed winnable in the rare fallback case — that limitation is intentional
// and documented rather than hidden.
//
// Auto Play (2026-09-23) reuses this SAME search, unchanged, rather than writing a second one: it
// just also keeps the winning move sequence the search already finds internally (`solveFromBoard`)
// instead of throwing it away, so it can play the actual proven line back through the real
// rules.js move functions one THINK/REVEAL/ACT step at a time.

import { freshDeck } from './deck.js';
import {
  dealKlondike,
  cloneBoard,
  allLegalMoves,
  drawFromStock,
  moveWasteToFoundation,
  moveWasteToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  isWon,
} from './rules.js';

function boardKey(board) {
  const t = board.tableau.map((col) => col.map((c) => (c.faceUp ? c.suit + c.rank : 'x')).join(',')).join('|');
  const f = ['S', 'H', 'D', 'C'].map((s) => board.foundations[s].length).join(',');
  const w = board.waste.map((c) => c.suit + c.rank).join(',');
  return `${t}#${f}#${board.stock.length}#${w}`;
}

// Repeatedly move any card that can safely go to a foundation. Mutates `board` in place, and (when
// `path` is given) appends the exact move descriptor for each foundation move it makes, so a caller
// that wants to REPLAY the search's solution (Auto Play) can, rather than just knowing one exists.
function applyGreedyFoundationMoves(board, path) {
  let moved = true;
  while (moved) {
    moved = false;
    if (moveWasteToFoundation(board)) {
      path?.push({ kind: 'waste-foundation' });
      moved = true;
      continue;
    }
    for (let col = 0; col < board.tableau.length; col++) {
      const top = board.tableau[col].length - 1;
      if (top >= 0) {
        const index = top;
        if (moveTableauToFoundation(board, col, top)) {
          path?.push({ kind: 'tableau-foundation', col, index });
          moved = true;
          break;
        }
      }
    }
  }
}

function moveScore(move, board) {
  if (move.kind === 'draw') return -1;
  if (move.kind === 'waste-tableau') return 1;
  if (move.kind === 'tableau-tableau') {
    const column = board.tableau[move.col];
    const reveals = move.index > 0 && !column[move.index - 1].faceUp;
    return reveals ? 5 : 0;
  }
  return 0;
}

// The core bounded search. Returns the full list of moves that solves `initialBoard` (in order,
// ready to replay through the real rules.js functions), or `null` if the search budget ran out
// before finding one (NOT proof of unsolvability — see the HONESTY NOTE above).
export function solveFromBoard(initialBoard, { nodeBudget = 3000, maxStockCycles = 6 } = {}) {
  const visited = new Set();
  let nodes = 0;

  function dfs(board, cycles, path) {
    nodes++;
    if (nodes > nodeBudget) return null;
    applyGreedyFoundationMoves(board, path);
    if (isWon(board)) return path;

    const key = `${boardKey(board)}@${cycles}`;
    if (visited.has(key)) return null;
    visited.add(key);
    if (visited.size > nodeBudget * 4) return null;

    const moves = allLegalMoves(board).filter((m) => m.kind !== 'tableau-foundation' && m.kind !== 'waste-foundation');
    moves.sort((a, b) => moveScore(b, board) - moveScore(a, board));

    for (const move of moves) {
      if (nodes > nodeBudget) return null;
      if (move.kind === 'draw') {
        const recycling = board.stock.length === 0;
        if (recycling && cycles >= maxStockCycles) continue;
        const next = cloneBoard(board);
        drawFromStock(next);
        const result = dfs(next, recycling ? cycles + 1 : cycles, [...path, { kind: 'draw' }]);
        if (result) return result;
        continue;
      }
      const next = cloneBoard(board);
      let applied = false;
      if (move.kind === 'waste-tableau') applied = moveWasteToTableau(next, move.col);
      else if (move.kind === 'tableau-tableau') applied = moveTableauToTableau(next, move.col, move.index, move.to);
      if (applied) {
        const result = dfs(next, cycles, [...path, move]);
        if (result) return result;
      }
    }
    return null;
  }

  return dfs(cloneBoard(initialBoard), 0, []);
}

export function isLikelyWinnable(initialBoard, opts = {}) {
  return solveFromBoard(initialBoard, opts) !== null;
}

// Draws shuffles from `rng` (never Math.random) until one is confirmed winnable or the attempt
// cap is reached. Every attempt consumes the next values from the SAME rng stream, so the whole
// process stays deterministic for a given seed. `moves` is the exact proven solution line for the
// dealt board when `verified` is true (used by Auto Play); it is `null` in the unverified fallback.
export function generateWinnableDeal(rng, { maxAttempts = 60, nodeBudget = 4000 } = {}) {
  let board = null;
  let moves = null;
  let verified = false;
  let attempts = 0;
  for (let i = 1; i <= maxAttempts; i++) {
    attempts = i;
    const shuffled = rng.shuffle(freshDeck());
    board = dealKlondike(shuffled);
    const solution = solveFromBoard(board, { nodeBudget });
    if (solution) {
      verified = true;
      moves = solution;
      break;
    }
  }
  return { board, verified, attempts, moves };
}
