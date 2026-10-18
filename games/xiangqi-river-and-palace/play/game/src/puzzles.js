// The daily puzzle. Puzzles are pre-built and PROVEN offline (design/tools/gen-puzzles.mjs, src/solver.js): Red to move
// forces checkmate in exactly n moves. Weekdays use mate-in-2, weekends mate-in-3. Same puzzle for everyone on a given day.
import { PUZZLES } from './puzzledata.js';
import { boardFromText, sqOf } from './rules.js';

export const isWeekend = (day) => { const dow = (day + 4) % 7; return dow === 0 || dow === 6; };   // day 0 (1970-01-01) was a Thursday
export function puzzleFor(day) {
  const want = isWeekend(day) ? 3 : 2, pool = PUZZLES.filter((p) => p.n === want), list = pool.length ? pool : PUZZLES;
  const idx = (Math.imul(day >>> 0, 2654435761) >>> 0) % list.length;
  const p = list[idx];
  return { id: PUZZLES.indexOf(p), n: p.n, board: boardFromText(p.rows), tree: p.tree };
}
export const puzzleById = (id) => { const p = PUZZLES[id]; return { id, n: p.n, board: boardFromText(p.rows), tree: p.tree }; };
export const PUZZLE_COUNT = PUZZLES.length;
export const moveKey = (from, to) => from + '-' + to;
export { sqOf };
