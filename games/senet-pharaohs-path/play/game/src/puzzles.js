// Daily puzzle: a real position, a fixed throw, and ONE clearly best move, proven by the same search the computer uses.
// The same puzzle for everyone on a given day (seeded by env.config.day). Built a slice at a time so a frame is never blocked.
import { newGame, legalMoves, applyMove, endThrow, clone, describe } from './rules.js';
import { scoreMoves } from './ai.js';

const lcg = (seed) => { let s = (seed * 2654435761 + 12345) >>> 0; const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { next, chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)], int: (n) => Math.floor(next() * n) }; };
const MARGIN = 6;
const throwOf = (r) => { let l = 0; for (let i = 0; i < 4; i++) if (r.chance(0.5)) l++; return l === 0 ? 5 : l; };

export function createPuzzleMaker(day) {
  const r = lcg(day + 1); let job = null, tries = 0, cand = null;
  return {
    step() {
      if (!job) {
        tries++;
        const g = newGame(), plies = 14 + r.int(60);
        for (let k = 0; k < plies && g.winner === null; k++) { g.n = throwOf(r); const ms = legalMoves(g); if (ms.length) applyMove(g, r.pick(ms)); else endThrow(g); }
        if (g.winner !== null) return {};
        g.n = throwOf(r); g.extra = false;
        if (legalMoves(g).length < 3) return {};
        cand = clone(g); job = scoreMoves(clone(g), 3); return {};
      }
      const res = job.next();
      if (!res.done) return {};
      job = null;
      const sc = res.value.slice().sort((a, b) => b.v - a.v);
      if (sc[0].v - sc[1].v < MARGIN && tries < 60) return {};
      const m = sc[0].m;
      return { puzzle: { board: cand.board, off: cand.off, turn: cand.turn, n: cand.n, best: { from: m.from, dest: m.dest }, why: describe(cand, m), tries } };
    },
  };
}
export const puzzleGame = (p) => ({ board: p.board.slice(), off: p.off.slice(), turn: p.turn, n: p.n, extra: false, winner: null, throws: 0, moves: 0, reason: '' });
