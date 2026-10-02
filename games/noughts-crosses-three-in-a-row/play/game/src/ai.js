// Opponents, Beginner to Perfect. Every level is built on the exact solver: the lower levels mostly play
// "like a person" (spot an immediate win, sometimes block, otherwise wander) and only sometimes consult it.
import { legalMoves, applyMove, result, other } from './rules.js';
import { scoreMoves } from './solver.js';
import { winMoves, lineMoves, lineCount } from './analysis.js';

export const LEVELS = [
  { id: 'beginner', name: 'Beginner', blurb: 'Plays quickly and misses things. Good for learning.', solve: 0.0, win: 0.55, block: 0.35, avoid: 0.4 },
  { id: 'casual', name: 'Casual', blurb: 'Takes easy wins, blocks most of the time.', solve: 0.25, win: 0.85, block: 0.65, avoid: 0.7 },
  { id: 'skilled', name: 'Skilled', blurb: 'Rarely misses a threat; can still be forked.', solve: 0.6, win: 1, block: 0.92, avoid: 0.9 },
  { id: 'expert', name: 'Expert', blurb: 'Plays almost perfectly, with an occasional slip.', solve: 0.9, win: 1, block: 1, avoid: 1 },
  { id: 'perfect', name: 'Perfect', blurb: 'A solver that never makes a mistake.', solve: 1, win: 1, block: 1, avoid: 1 },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

// Weighted pick; heavier weights are likelier, so openings look like a player's: centre and corners first.
function weightedPick(rng, items, weight) {
  let total = 0;
  for (const it of items) total += weight(it);
  let r = rng.next() * total;
  for (const it of items) { r -= weight(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

export function bestMoves(st, list = scoreMoves(st)) {
  const top = Math.max(...list.map((x) => x.s));
  return list.filter((x) => x.s === top);
}

// The solver's pick: among equally good moves prefer the ones on the most lines (centre, corners), with a random tie-break.
export function solverMove(st, rng, list = scoreMoves(st)) {
  const best = bestMoves(st, list), lc = lineCount(st.mode);
  return weightedPick(rng, best, (x) => 1 + lc[x.mv.to] * lc[x.mv.to]).mv;
}

function shallowMove(st, lv, rng) {
  const me = st.turn, opp = other(me), moves = legalMoves(st);
  const wins = moves.filter((mv) => { const r = result(applyMove(st, mv)); return r && r.winner === me; });
  if (wins.length && rng.chance(lv.win)) return rng.pick(wins);
  const suicide = new Set(lineMoves(st, me).filter((mv) => { const r = result(applyMove(st, mv)); return r && r.winner === opp; }).map((m) => `${m.from}:${m.to}`));
  const threats = winMoves(st, opp);
  let pool = moves;
  if (threats.length && rng.chance(lv.block)) {
    const stops = moves.filter((mv) => !winMoves(applyMove(st, mv), opp).length);
    if (stops.length) pool = stops;
  }
  if (suicide.size && rng.chance(lv.avoid)) {
    const safe = pool.filter((mv) => !suicide.has(`${mv.from}:${mv.to}`));
    if (safe.length) pool = safe;
  }
  const lc = lineCount(st.mode);
  return weightedPick(rng, pool, (mv) => 1 + (lv.solve > 0.2 ? lc[mv.to] : 0.5));
}

export function chooseMove(st, level, rng) {
  const lv = typeof level === 'string' ? levelById(level) : level;
  const moves = legalMoves(st);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (lv.solve >= 1 || rng.chance(lv.solve)) {
    const list = scoreMoves(st);
    if (lv.id === 'expert' && rng.chance(0.12)) {
      // the occasional slip: a move that is not the best but does not lose on the spot
      const top = Math.max(...list.map((x) => x.s));
      const lesser = list.filter((x) => x.s < top && x.s > -90);
      if (lesser.length) return rng.pick(lesser).mv;
    }
    return solverMove(st, rng, list);
  }
  return shallowMove(st, lv, rng);
}
