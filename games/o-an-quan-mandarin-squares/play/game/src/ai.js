// The computer opponent: five levels. Each searches whole turns (a turn = pick a square and a direction, sow, capture)
// with alpha-beta. Lower levels search less deep and sometimes play a random move.
import { legalMoves, play, scoreOf, sideCount, other } from './engine.js';

export const LEVELS = [
  { id: 'novice', depth: 0, rnd: 1 },
  { id: 'casual', depth: 1, rnd: 0.3 },
  { id: 'club', depth: 2, rnd: 0.1 },
  { id: 'expert', depth: 4, rnd: 0 },
  { id: 'master', depth: 8, rnd: 0 },
];
export const LEVEL_IDS = LEVELS.map((l) => l.id);

// Position value from player p's side: the score lead plus a little for stones kept on your own side.
function value(s, p) {
  if (s.over) return (scoreOf(s, p) - scoreOf(s, other(p))) * 100;
  return (scoreOf(s, p) - scoreOf(s, other(p))) * 10 + (sideCount(s, p) - sideCount(s, other(p))) * 1.5;
}

function search(s, depth, alpha, beta, p) {
  if (s.over || depth === 0) return value(s, p);
  const ms = orderMoves(s);
  if (!ms.length) return value(s, p);
  if (s.turn === p) {
    let best = -Infinity;
    for (const m of ms) {
      const v = search(m.st, depth - 1, alpha, beta, p);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of ms) {
    const v = search(m.st, depth - 1, alpha, beta, p);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Moves with the most immediate gain first, so alpha-beta cuts early.
function orderMoves(s) {
  const out = legalMoves(s).map((mv) => ({ mv, st: play(s, mv).st }));
  const me = s.turn;
  for (const o of out) o.k = scoreOf(o.st, me);
  out.sort((a, b) => b.k - a.k);
  return out;
}

// Every legal move with its value at a given depth (for hints and for choosing).
export function rankMoves(s, depth) {
  const me = s.turn;
  const res = orderMoves(s).map((o) => ({ mv: o.mv, v: depth <= 0 ? scoreOf(o.st, me) - scoreOf(o.st, other(me)) : search(o.st, depth - 1, -Infinity, Infinity, me) }));
  return res;
}

export function chooseMove(s, levelId, rng) {
  const lv = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2];
  const ms = legalMoves(s);
  if (!ms.length) return null;
  if (lv.rnd >= 1 || (lv.rnd > 0 && rng.chance(lv.rnd))) return rng.pick(ms);
  const r = rankMoves(s, Math.max(1, lv.depth));
  let best = -Infinity;
  for (const x of r) if (x.v > best) best = x.v;
  const top = r.filter((x) => x.v >= best - 1e-9);
  return rng.pick(top).mv;
}
