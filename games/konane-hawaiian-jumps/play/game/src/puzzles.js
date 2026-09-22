// The daily puzzle. Everyone gets the same one on the same day. It is grown from a day-seeded game between two careless players
// and kept only if the exact solver PROVES that the side to move has exactly ONE winning first jump (out of three or more).
// Weekdays: 6x6 boards; Saturday and Sunday: 8x8 boards. step() does a small, fixed amount of work per call so it can run inside
// the game loop without a stall; it is deterministic (own seeded stream, no clock).
import { newGame, applyMove, legalMoves, stones, clone } from './rules.js';
import { winningMoves } from './engine.js';

function stream(seed) {
  let s = (seed * 2654435761) >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { next, int: (n) => Math.floor(next() * n) };
}
export const isWeekend = (day) => day % 7 === 2 || day % 7 === 3;      // 1970-01-01 was a Thursday
const LIMIT = { 6: 19, 8: 24 };                                        // stones left when the puzzle is cut from the game

export function createPuzzleMaker(day) {
  const r = stream(day + 977), n = isWeekend(day) ? 8 : 6, cut = LIMIT[n];
  let tries = 0;
  return {
    step() {
      tries += 1;
      let s = newGame(n);
      const pick = () => { const ms = legalMoves(s); return ms[r.int(ms.length)]; };
      while (!s.winner && (s.ply < 2 || stones(s, 1) + stones(s, 2) > cut)) applyMove(s, pick());
      if (!s.winner) {
        const legal = legalMoves(s);
        if (legal.length >= 3 && legal.length <= 9) {
          const w = winningMoves(s, 6000);
          if (w && w.length === 1) return { puzzle: { n, b: s.b.slice(), turn: s.turn, hole: s.hole, solution: w, legal: legal.length, tries } };
        }
      }
      return { puzzle: null };
    },
  };
}
export const puzzleGame = (p) => ({ n: p.n, b: p.b.slice(), turn: p.turn, ply: 2, hole: p.hole, winner: 0, reason: '', moves: 0 });
export const same = (a, b) => a.from === b.from && a.to === b.to;
export const isPuzzleSolution = (p, m) => p.solution.some((x) => same(x, m));
void clone;
