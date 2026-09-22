// The computer opponents. Every level reads the SOLVED game (solver.js): a level is defined by how far ahead it
// can see (in plies) and how often it slips (plays a random legal move). The top two never slip; the last one
// also sets traps. Instant: a table lookup, so the game never waits on a search.
import { legalMoves, other } from './rules.js';
import { rate, verdict } from './solver.js';

export const LADDER = [
  { name: 'Pebble', sight: 0, slip: 0.6, note: 'Plays almost at random.' },
  { name: 'Sand Crab', sight: 0, slip: 0.4, note: 'Wanders sideways. Rarely plans.' },
  { name: 'Sandpiper', sight: 1, slip: 0.35, note: 'Spots a move that wins on the spot.' },
  { name: 'Gull', sight: 1, slip: 0.2, note: 'Takes a quick win when it sees one.' },
  { name: 'Fantail', sight: 2, slip: 0.25, note: 'Avoids a move that loses at once.' },
  { name: 'Heron', sight: 2, slip: 0.12, note: 'Patient. Sees one reply ahead.' },
  { name: 'Kingfisher', sight: 3, slip: 0.12, note: 'Sees two moves ahead.' },
  { name: 'Tern', sight: 4, slip: 0.1, note: 'Sees a trap two moves before it closes.' },
  { name: 'Gannet', sight: 6, slip: 0.06, note: 'Sees everything, but sometimes lets go.' },
  { name: 'Albatross', sight: 6, slip: 0.03, note: 'Almost never slips.' },
  { name: 'Old Tide', sight: 6, slip: 0, note: 'Perfect safety. Cannot be beaten, only held to a draw.' },
  { name: 'Deep Current', sight: 6, slip: 0, traps: true, note: 'Perfect, and it sets traps for you.' },
];

// Which of the mover's moves does a level pick?  `rng` is env.rng.
export function pickMove(g, rung, rng) {
  const L = LADDER[Math.max(0, Math.min(11, rung - 1))], rated = rate(g.board, g.turn);
  if (!rated.length) return null;
  if (L.slip && rng.chance(L.slip)) return rng.pick(rated).m;
  const seen = (x) => x.v !== 0 && x.p <= L.sight;
  const wins = rated.filter((x) => x.v === 1 && seen(x)).sort((a, b) => a.p - b.p);
  if (wins.length) return wins[0].m;
  let pool = rated.filter((x) => !(x.v === -1 && seen(x)));
  if (!pool.length) pool = rated.slice().sort((a, b) => b.p - a.p).slice(0, 1);
  if (L.traps) {
    const draws = pool.filter((x) => x.v === 0);
    if (draws.length) pool = draws;
    let best = -1, top = [];
    for (const x of pool) {
      const n = trapScore(g, x.m); if (n > best) { best = n; top = [x]; } else if (n === best) top.push(x);
    }
    pool = top;
  }
  return rng.pick(pool).m;
}
// How many of the opponent's replies to this move would lose (a trap has a high score).
function trapScore(g, m) {
  const b = g.board.slice(), t = g.turn; b[m.to] = t; b[m.from] = 0;
  const replies = rate(b, other(t)); if (!replies.length) return 99;
  return replies.filter((x) => x.v === -1).length / replies.length;
}
// The best move for hints and puzzles: fastest win, else a drawing move, else the longest resistance.
export function bestMoves(b, t) {
  const r = rate(b, t); if (!r.length) return [];
  const wins = r.filter((x) => x.v === 1); if (wins.length) { const p = Math.min(...wins.map((x) => x.p)); return wins.filter((x) => x.p === p); }
  const draws = r.filter((x) => x.v === 0); if (draws.length) return draws;
  const p = Math.max(...r.map((x) => x.p)); return r.filter((x) => x.p === p);
}
// A short reason for a hint.
export function hintReason(b, t, m) {
  const r = rate(b, t).find((x) => x.m.from === m.from && x.m.to === m.to); if (!r) return '';
  if (r.v === 1) return r.p === 1 ? 'This move leaves your opponent with no move at all: you win.' : `A winning move: with best play it wins in ${(r.p + 1) / 2} moves.`;
  if (r.v === 0) return 'A safe move: it keeps the game level. Other moves here would lose.';
  return 'Every move loses here; this one holds out the longest.';
}
// Word for a whole position, for the little "who is ahead" line.
export const sayVerdict = (b, t) => { const v = verdict(b, t); return v.r === 1 ? 'win' : v.r === -1 ? 'loss' : 'draw'; };
// Deterministic reply used by the puzzles and lessons: the move that resists longest.
export function stubborn(b, t) {
  const r = rate(b, t); if (!r.length) return null;
  const rank = (x) => (x.v === 1 ? 1000 - x.p : x.v === 0 ? 500 : x.p);
  return r.slice().sort((a, b2) => rank(b2) - rank(a))[0].m;
}
