// Daily puzzle: "Defenders to move. Win in two." Positions are random sparse boards, PROVEN by the solver:
// exactly one first move forces the win (king in a corner on the defenders' second move, whatever the attackers do).
import { fromRows, legalMoves, make, unmake, DEF, ATT, KING, clone, isCorner, throne } from './rules.js';
import { defenderWins, evaluate } from './engine.js';

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function createPuzzleMaker(day) {
  const rnd = lcg((day * 2654435761 + 12345) >>> 0);
  const n = day % 2 === 0 ? 11 : 7;
  let tries = 0;
  return {
    n, get tries() { return tries; },
    step() {
      tries += 1;
      const N = n * n, rows = Array.from({ length: n }, () => Array(n).fill('.')), free = [];
      for (let i = 0; i < N; i++) if (!isCorner(n, i) && i !== throne(n)) free.push(i);
      const take = () => free.splice(Math.floor(rnd() * free.length), 1)[0];
      const put = (i, c) => { rows[Math.floor(i / n)][i % n] = c; };
      put(take(), 'K');
      const na = n === 11 ? 9 + Math.floor(rnd() * 5) : 4 + Math.floor(rnd() * 3), nd = n === 11 ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < na; k++) put(take(), 'A');
      for (let k = 0; k < nd; k++) put(take(), 'D');
      const g = fromRows(rows.map((r) => r.join('')), DEF);
      if (defenderWins(g, 1).length) return { puzzle: null };
      const good = defenderWins(g, 2);
      if (good.length !== 1) return { puzzle: null };
      return { puzzle: { rows: rows.map((r) => r.join('')), solution: good[0], n } };
    },
  };
}
export const puzzleGame = (p) => fromRows(p.rows, DEF);
// The attackers' reply after a correct first move: the one that leaves the king fewest open lines (1-ply, deterministic).
export function bestReply(g) {
  let best = null, bs = Infinity;
  for (const m of legalMoves(g)) {
    const r = make(g, m.from, m.to);
    const s = g.winner === ATT ? -1e9 : evaluate(g);
    unmake(g, r);
    if (s < bs || (s === bs && best === null)) { bs = s; best = m; }
  }
  return best;
}
export const PUZZLE_TEXT = { title: 'Win in two', goal: 'The defenders move first. Find the one move that wins in two, whatever the attackers answer.' };
void KING; void clone;
