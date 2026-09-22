// The daily puzzle: a position that is WON for the side to move (win in 1, 2 or 3 moves), taken from the solved
// table, so every puzzle is proven and every winning first move is accepted. Same puzzle for everyone on a day.
import { wonPositions } from './solver.js';

let POOL = null;
const pool = () => POOL || (POOL = wonPositions().sort((a, b) => a.plies - b.plies || a.board.join('').localeCompare(b.board.join('')) || a.turn - b.turn));
const hash = (n) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
export const dayOfWeek = (day) => (((day + 4) % 7) + 7) % 7;      // 0 = Sunday (day 0 was a Thursday)
export const PLIES_FOR = (day) => { const d = dayOfWeek(day); return d === 1 || d === 2 ? 1 : d === 6 || d === 0 ? 5 : 3; };

// Rotate / mirror the ring, and optionally swap the two colours, so the same position looks different.
function variant(p, h) {
  const rot = h % 8, mirror = (h >> 3) & 1, swap = (h >> 4) & 1, b = new Array(9);
  for (let i = 0; i < 8; i++) { const j = mirror ? (8 - i) % 8 : i; b[(j + rot) % 8] = p.board[i]; }
  b[8] = p.board[8];
  const board = swap ? b.map((x) => (x ? 3 - x : 0)) : b;
  return { board, turn: swap ? 3 - p.turn : p.turn, plies: p.plies };
}
export function puzzleFor(day) {
  const want = PLIES_FOR(day), all = pool().filter((p) => p.plies === want), h = hash(day + 17);
  const base = all[h % all.length];
  return variant(base, hash(day * 7 + 3));
}
export const movesToWin = (p) => (p.plies + 1) / 2;
