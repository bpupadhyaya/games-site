// The computer players. Four personalities, all using the same rule book (rules.js) and the real throw odds.
import { geo, trackIndex, trackMap, throwOdds, legalMoves } from './rules.js';

export const LEVELS = ['beginner', 'cautious', 'balanced', 'bold'];
export const LEVEL_NAMES = { beginner: 'Beginner', cautious: 'Cautious', balanced: 'Balanced', bold: 'Bold' };
export const LEVEL_BLURB = {
  beginner: 'Plays any legal move.',
  cautious: 'Hides on safe squares and builds blocks.',
  balanced: 'Weighs risk, captures and progress.',
  bold: 'Hunts captures and sprints, ignoring risk.',
};

// weights: capture, risk, safe, block, progress, enter, home
const W = {
  cautious: { cap: 0.9, risk: 2.4, safe: 1.6, block: 1.6, prog: 0.8, enter: 1.0, home: 1 },
  balanced: { cap: 1.2, risk: 1.3, safe: 1.0, block: 1.0, prog: 1.0, enter: 1.1, home: 1 },
  bold: { cap: 2.2, risk: 0.3, safe: 0.4, block: 0.4, prog: 1.4, enter: 1.3, home: 1 },
};

// chance that some rival lands exactly on outer square t with its next throw
function danger(g, pl, t, map, odds) {
  const G = geo(g.mode);
  if (G.safe.has(t)) return 0;
  let s = 0;
  g.pos.forEach((ps, o) => {
    if (o === pl) return;
    ps.forEach((p) => {
      const tr = trackIndex(g, o, p);
      if (tr == null) return;
      const d = (t - tr + G.T) % G.T;
      if (d > 0 && p + d <= G.T - 1 && odds[d]) s += odds[d];
    });
  });
  return Math.min(0.95, s);
}

function score(g, m, w, map, odds) {
  const G = geo(g.mode), pl = m.pl, p = m.from;
  let sc = 0;
  const tTo = trackIndex(g, pl, m.to), tFrom = trackIndex(g, pl, p);
  if (m.caps.length) for (const [o, k] of m.caps) sc += w.cap * (30 + (g.pos[o][k] + 1) * 0.9);
  if (m.to === G.END) sc += w.home * 45;
  if (m.enter) sc += w.enter * 26;
  else sc += w.prog * m.value * 0.9;
  if (m.to >= G.T) sc += 6;
  if (tTo != null) {
    const mine = (map.get(tTo) || []).filter(([o]) => o === pl).length;
    if (G.safe.has(tTo)) sc += w.safe * 16;
    else if (G.blocks && mine >= 1) sc += w.block * 14;
    else sc -= w.risk * danger(g, pl, tTo, map, odds) * (m.to + 22);
  }
  if (tFrom != null && !m.enter) {
    const mine = (map.get(tFrom) || []).filter(([o]) => o === pl).length;
    const d = G.blocks && mine >= 2 ? 0 : danger(g, pl, tFrom, map, odds);
    sc += w.risk * d * (p + 22) * 0.9; // getting out of trouble
    if (G.blocks && mine >= 2) sc -= w.block * 6; // breaking a block
  }
  return sc;
}

// the computer's choice among legal moves (list from legalMoves)
export function chooseMove(g, moves, level, rng) {
  if (moves.length === 1) return moves[0];
  if (level === 'beginner') {
    if (rng.chance(0.35)) return best(g, moves, W.balanced, rng, 0);
    return rng.pick(moves);
  }
  return best(g, moves, W[level] ?? W.balanced, rng, 1.2);
}

function best(g, moves, w, rng, noise) {
  const map = trackMap(g), odds = throwOdds(g.mode);
  let bm = moves[0], bs = -1e9;
  for (const m of moves) {
    const s = score(g, m, w, map, odds) + rng.range(0, noise);
    if (s > bs) { bs = s; bm = m; }
  }
  return bm;
}

// advice for the Hint button
export function hintMove(g, value, grace, rng) {
  const moves = legalMoves(g, value, grace);
  return moves.length ? best(g, moves, W.balanced, rng, 0) : null;
}
