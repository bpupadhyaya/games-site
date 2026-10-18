// The no-guess board generator and its logical solver.
//
// SOLVER LEVEL (documented per docs/GAME-CONTRACT.md / the GDD "risks" section):
//   1. Single-point deduction — a revealed N with exactly N unopened neighbours means all of
//      them are mines; a revealed N whose flagged neighbours already number N means every other
//      unopened neighbour is safe.
//   2. Subset/pair deduction — for two revealed numbers whose unopened-neighbour sets are in a
//      subset relation, the difference of the sets and the difference of their counts gives a
//      new, smaller constraint (this solves classic patterns single-point deduction alone
//      cannot, e.g. many "1-2-1" edges).
//   3. A global endgame count rule — if the number of mines still unflagged equals the number of
//      still-unopened cells, every one of them is a mine; if zero mines remain unflagged, every
//      unopened cell is safe.
// This is NOT full constraint-satisfaction / brute-force enumeration (no probability reasoning,
// no exhaustive combination search across independent frontier islands). It is an honest,
// bounded, terminating deduction pass — see STATUS.md for what a stronger solver would add.
import { neighbors, computeNumbers, floodReveal } from './board.js';

// Returns every forced move derivable in one logical pass from the given revealed/flagged
// state: { index, kind: 'safe' | 'mine' }[]. Pure function — no mutation, no randomness.
export function findForcedMoves(w, h, numbers, revealed, flagged) {
  const total = w * h;
  const constraints = [];
  for (let i = 0; i < total; i++) {
    if (!revealed[i] || numbers[i] <= 0) continue;
    const unknown = [];
    let flagCount = 0;
    for (const n of neighbors(i, w, h)) {
      if (flagged[n]) flagCount++;
      else if (!revealed[n]) unknown.push(n);
    }
    if (unknown.length === 0) continue;
    constraints.push({ cells: unknown, count: numbers[i] - flagCount });
  }

  const moves = [];
  const seen = new Set();
  const add = (index, kind) => {
    const key = `${index}:${kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push({ index, kind });
    }
  };

  // Single-point deduction.
  for (const { cells, count } of constraints) {
    if (count <= 0) cells.forEach((c) => add(c, 'safe'));
    else if (count === cells.length) cells.forEach((c) => add(c, 'mine'));
  }
  if (moves.length > 0) return moves;

  // Subset/pair deduction: if A's unknown cells are a subset of B's, the remainder of B
  // carries exactly (B.count - A.count) mines among the cells B has that A doesn't.
  for (let a = 0; a < constraints.length; a++) {
    const A = constraints[a];
    for (let b = 0; b < constraints.length; b++) {
      if (a === b) continue;
      const B = constraints[b];
      if (B.cells.length <= A.cells.length) continue;
      if (!A.cells.every((c) => B.cells.includes(c))) continue;
      const diffCells = B.cells.filter((c) => !A.cells.includes(c));
      const diffCount = B.count - A.count;
      if (diffCount === 0) diffCells.forEach((c) => add(c, 'safe'));
      else if (diffCount === diffCells.length) diffCells.forEach((c) => add(c, 'mine'));
    }
  }
  return moves;
}

// Simulates solving a fully-known board from `start` using only the deduction levels above.
// Returns { solved, revealed, flagged, numbers }. `solved` means every non-mine cell was
// opened — the honest definition of "this board never required a guess to finish".
export function solveBoard(w, h, mines, start, opts = {}) {
  const total = w * h;
  const maxIterations = opts.maxIterations ?? total * 4 + 10; // generous; loop always exits
  const numbers = computeNumbers(mines, w, h);
  const mineCount = mines.size;
  const revealed = new Array(total).fill(false);
  const flagged = new Array(total).fill(false);
  floodReveal(revealed, numbers, start, w, h);

  for (let iter = 0; iter < maxIterations; iter++) {
    let progressed = false;
    for (const { index, kind } of findForcedMoves(w, h, numbers, revealed, flagged)) {
      if (kind === 'safe' && !revealed[index] && !flagged[index]) {
        floodReveal(revealed, numbers, index, w, h);
        progressed = true;
      } else if (kind === 'mine' && !flagged[index]) {
        flagged[index] = true;
        progressed = true;
      }
    }

    if (!progressed) {
      let flaggedCount = 0;
      const unrevealed = [];
      for (let i = 0; i < total; i++) {
        if (flagged[i]) flaggedCount++;
        else if (!revealed[i]) unrevealed.push(i);
      }
      const remainingMines = mineCount - flaggedCount;
      if (remainingMines === 0 && unrevealed.length > 0) {
        unrevealed.forEach((c) => floodReveal(revealed, numbers, c, w, h));
        progressed = true;
      } else if (remainingMines === unrevealed.length && unrevealed.length > 0) {
        unrevealed.forEach((c) => {
          flagged[c] = true;
        });
        progressed = true;
      }
    }

    if (!progressed) break;
  }

  let revealedNonMine = 0;
  for (let i = 0; i < total; i++) if (revealed[i] && !mines.has(i)) revealedNonMine++;
  return { solved: revealedNonMine === total - mineCount, revealed, flagged, numbers };
}

// Places mines with `rng` so the resulting board is solvable by `solveBoard` alone, starting
// from a safe opening. Rejection-sampling: reshuffle mines (and re-pick the opening) up to
// `maxAttempts` times, deterministically consuming the same rng stream every time so the whole
// process stays reproducible from a seed. Bounded and terminating by construction: each attempt
// does O(w*h) work for placement plus a `solveBoard` call whose own loop is capped above, so the
// worst case is `maxAttempts * (solveBoard cost)` — no possibility of hanging forever.
export function generateBoard(rng, w, h, mineCount, maxAttempts = 500) {
  const total = w * h;
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = rng.int(total);
    // Keep the opening's own 3x3 neighbourhood mine-free so the first reveal always opens a
    // real (non-trivial) blank region instead of a single lonely number.
    const safeZone = new Set([start, ...neighbors(start, w, h)]);
    const pool = [];
    for (let i = 0; i < total; i++) if (!safeZone.has(i)) pool.push(i);
    const shuffled = rng.shuffle(pool);
    const mines = new Set(shuffled.slice(0, mineCount));

    const result = solveBoard(w, h, mines, start);
    last = { mines, start };
    if (result.solved) return { mines, start, attempts: attempt, fellBack: false };
  }
  // Every attempt within the cap failed to be fully solvable by deduction alone. Rather than
  // looping forever (or silently shipping a board that might need a guess), fall back to the
  // last attempted layout and tell the caller so it can be surfaced/logged. See STATUS.md.
  return { mines: last.mines, start: last.start, attempts: maxAttempts, fellBack: true };
}
