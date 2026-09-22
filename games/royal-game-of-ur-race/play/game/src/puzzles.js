// The daily puzzle: "Find the best move". A position and a roll, made from the day number alone (the same for everyone),
// and PROVEN by search: the best move must beat every other move by a clear margin. Built by a generator so the search
// can be spread over many frames while the title screen is showing.
import { newGame, clone, legalMoves, applyMove, pass, rollDice, ODDS } from './rules.js';
import { bestMoves, explain } from './engine.js';

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const same = (a, b) => a.i === b.i && a.to === b.to;
export const puzzleKey = (m) => `${m.from}>${m.to}`;

// Returns { step(): { puzzle } } : call step() a few times per frame until puzzle is set.
export function createPuzzleMaker(day) {
  const rnd = lcg((day * 2654435761) >>> 0), pick = (n) => Math.floor(rnd() * n);
  const rngLike = { int: (n) => Math.floor(rnd() * n), chance: (p) => rnd() < p, pick: (a) => a[Math.floor(rnd() * a.length)] };
  let attempt = 0, best = null;
  const step = () => {
    attempt += 1;
    const g = newGame(pick(2)), plies = 12 + pick(28);
    let n = 0;
    while (g.winner < 0 && n < plies) {                        // random plausible play, biased to capture and take rosettes
      g.roll = rollDice(rngLike).total;
      const ms = legalMoves(g);
      if (!ms.length) { pass(g); n++; continue; }
      const pref = ms.filter((m) => m.hit >= 0 || m.rosette || m.off), pool = pref.length && rnd() < 0.6 ? pref : ms;
      applyMove(g, pool[pick(pool.length)]); n++;
    }
    if (g.winner >= 0 || g.turn !== 0) return { puzzle: attempt > 60 ? best : null };
    g.roll = 1 + pick(4);                                       // the puzzle roll: 1..4 (the player is always side 0)
    const ms = legalMoves(g);
    if (ms.length < 3) return { puzzle: attempt > 60 ? best : null };
    const scored = bestMoves(clone(g), 2), margin = scored[0].v - scored[1].v;
    const cand = { pos: [g.pos[0].slice(), g.pos[1].slice()], turn: g.turn, roll: g.roll, best: puzzleKey(scored[0].move), margin, why: explain(g, scored[0].move) };
    if (!best || margin > best.margin) best = cand;
    if (margin >= 2.5 && g.turn === 0) return { puzzle: cand };
    return { puzzle: attempt > 60 ? best : null };
  };
  return { step };
}
export function puzzleGame(p) { return { pos: [p.pos[0].slice(), p.pos[1].slice()], turn: p.turn, roll: p.roll, winner: -1, moves: 0, extra: false }; }
