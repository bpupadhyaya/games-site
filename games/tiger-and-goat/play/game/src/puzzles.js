// The daily puzzle. Everyone gets the same one on the same day: it is grown from a day-seeded game between two
// careless computer players, and kept only if the solver PROVES a forced line with exactly one correct first move.
//   'catch' : tigers to move, win a goat by force (no capture available at once)
//   'trap'  : goats to move, leave every tiger without a move (no trap available at once)
// Weekdays are 2-move puzzles; Saturday and Sunday are 3-move puzzles (falls back to 2 moves if none is found).
// make.step() does a small, fixed amount of work per call (one self-play move + one proof attempt), so it can run
// inside the game loop without a stall, and it is fully deterministic: no clock, its own seeded random stream.
import { newGame, applyMove, legalMoves, clone } from './rules.js';
import { forcingMoves, chooseMove } from './engine.js';

function stream(seed) {
  let s = (seed * 2654435761) >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { next, int: (n) => Math.floor(next() * n), shuffle: (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; } };
}

export const PUZZLE_TEXT = {
  catch: { side: 'T', title: 'Tigers to move', goal: (n) => `Win a goat in ${n} moves. Only one first move works.` },
  trap: { side: 'G', title: 'Goats to move', goal: (n) => `Trap every tiger in ${n} moves. Only one first move works.` },
};
// day = whole days since 1970-01-01, which was a Thursday: Saturday is day % 7 === 2, Sunday is 3.
export const isWeekend = (day) => day % 7 === 2 || day % 7 === 3;

// A last resort that is always valid: the goats trap the last free tiger in one move.
const FALLBACK = { type: 'trap', n: 1, board: '.GGG.GGGGGGG.GGGGGGG.GGG.'.split('').map((c) => (c === '.' ? '' : c)), hand: 0 };
function fallback() {
  const b = FALLBACK.board.slice(); for (const c of [0, 4, 20, 24]) b[c] = 'T';
  return { type: 'trap', n: 1, board: b, hand: 0, first: [{ type: 'move', from: 17, to: 12 }], fallback: true };
}

export function createPuzzleMaker(day) {
  const want = day % 2 === 0 ? 'catch' : 'trap';
  let rnd = stream(day), game = newGame(), plies = 0, games = 0, work = 0;
  const found = (type, n, s, first) => ({ type, n, board: s.board.slice(), hand: s.inHand, first });
  return {
    step() {
      work++;
      if (work > 1000) return { puzzle: fallback() };
      // the plan: the wanted kind and length first; then a plain 2-move puzzle; then the other kind
      const plan = work <= 500 ? [want, isWeekend(day) ? 3 : 2] : work <= 750 ? [want, 2] : [want === 'catch' ? 'trap' : 'catch', 2];
      const [type, n] = plan;
      if (game.winner || plies > 90) { game = newGame(); plies = 0; games++; rnd = stream(day * 131 + games); }
      const s = game;
      if (plies >= 8 && ((type === 'catch' && s.turn === 'T') || (type === 'trap' && s.turn === 'G' && s.inHand === 0))) {
        let shorter = n === 1;
        for (let k = 1; k < n && !shorter; k++) { const r = forcingMoves(s, type, k, k === 1 ? 4000 : 20000); if (!r || r.length > 0) shorter = true; }   // an easier solution exists: not a puzzle of this length
        if (!shorter) { const f = forcingMoves(s, type, n, n === 3 ? 300000 : 40000); if (f && f.length === 1) return { puzzle: found(type, n, s, f) }; }
      }
      // two careless players: mostly sensible, sometimes random, so positions are natural but not perfect
      const ms = legalMoves(s);
      applyMove(s, rnd.next() < 0.3 ? ms[rnd.int(ms.length)] : chooseMove(s, 1, rnd)); plies++;
      return { puzzle: null };
    },
  };
}

// Set a rules.js game up from a puzzle.
export function puzzleGame(pz) { const g = newGame(); g.board = pz.board.slice(); g.inHand = pz.hand; g.turn = PUZZLE_TEXT[pz.type].side; g.captured = 20 - pz.hand - pz.board.filter((c) => c === 'G').length; return g; }
export { clone };
