// The daily puzzle. Everyone gets the same one on the same day. The game is small enough to be solved completely, so
// the pool is EXACT: every position reachable in a real game where the mover has a forced win in n moves with exactly
// one correct first move and no shorter win. The day picks one (and a left-right mirror of it) from the pool.
//   'trap'   : hounds to move, trap the hare in n moves
//   'escape' : hare to move, slip past the hounds in n moves
// Weekdays are shorter, Saturday and Sunday longer.
import { newGame, applyMove, legalMoves, clone, key, LAT } from './rules.js';
import { trapIn, escapeIn, forcingMoves, INF } from './engine.js';

export const PUZZLE_TEXT = {
  trap: { side: 'D', title: 'Hounds to move', goal: (n) => `Trap the hare in ${n} moves. Only one first move works.` },
  escape: { side: 'H', title: 'Hare to move', goal: (n) => `Slip past the hounds in ${n} moves. Only one first move works.` },
};
// day = whole days since 1970-01-01, which was a Thursday: Saturday is day % 7 === 2, Sunday is 3.
export const isWeekend = (day) => day % 7 === 2 || day % 7 === 3;

let pool = null;
function build() {
  if (pool) return pool;
  const seen = new Map(), q = [newGame(99)]; seen.set(key(q[0]), q[0]);
  while (q.length) {
    const s = q.shift();
    for (const m of legalMoves(s)) { const c = clone(s); applyMove(c, m); c.hm = 0; c.moves = 0; if (c.winner) continue; const k = key(c); if (!seen.has(k)) { seen.set(k, c); q.push(c); } }
  }
  pool = { trap: [], escape: [] };
  for (const s of [...seen.values()].sort((a, b) => (key(a) < key(b) ? -1 : 1))) {
    const type = s.turn === 'D' ? 'trap' : 'escape', n = type === 'trap' ? trapIn(s) : escapeIn(s);
    if (n >= INF || n < 2) continue;
    if (forcingMoves(s, type, n).length !== 1 || forcingMoves(s, type, n - 1).length !== 0) continue;
    pool[type].push({ type, n, board: s.board.slice() });
  }
  return pool;
}
const RANGE = { trap: [[2, 6], [7, 10]], escape: [[2, 3], [4, 8]] };
const hash = (day) => { let x = (Math.imul(day + 12345, 2654435761) >>> 0); x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
// mirror the board left to right: lane l -> 2 - l for the nine grid points
const flip = (b) => { const o = b.slice(); for (let i = 1; i <= 9; i++) o[i] = b[1 + 3 * Math.floor((i - 1) / 3) + (2 - LAT[i])]; return o; };

export function dailyPuzzle(day) {
  const P = build(), type = day % 2 === 0 ? 'trap' : 'escape', [lo, hi] = RANGE[type][isWeekend(day) ? 1 : 0];
  let cand = P[type].filter((p) => p.n >= lo && p.n <= hi);
  if (!cand.length) cand = P[type];
  const h = hash(day), p = cand[h % cand.length];
  return { type: p.type, n: p.n, board: (h >>> 20) & 1 ? flip(p.board) : p.board.slice() };
}
// Set a rules.js game up from a puzzle.
export function puzzleGame(pz) { const g = newGame(99); g.board = pz.board.slice(); g.turn = PUZZLE_TEXT[pz.type].side; return g; }
export const poolSizes = () => { const P = build(); return { trap: P.trap.length, escape: P.escape.length }; };
