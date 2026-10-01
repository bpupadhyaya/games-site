// The computer players. It plans BOTH dice of a roll (every ordered way to spend them), scores the resulting board with a
// weighted evaluation (progress, safety, barriers, captures, the rivals' real chance of hitting back using the true
// two-dice odds), and plays the first step of the best plan. Four personalities share the same rule book (rules.js).
import { T, END, isSafe, isSalida, trackIndex, trackMap, legalMoves, applyMove, progressOf } from './rules.js';

export const LEVELS = ['beginner', 'cautious', 'balanced', 'bold'];
export const LEVEL_NAMES = { beginner: 'Beginner', cautious: 'Cautious', balanced: 'Balanced', bold: 'Bold', mixed: 'Mixed' };
export const LEVEL_BLURB = {
  beginner: 'Often plays any legal move. Good for learning.',
  cautious: 'Hides on seguros, builds barriers, avoids risk.',
  balanced: 'Weighs risk, captures and progress.',
  bold: 'Hunts captures and sprints, ignoring risk.',
};
// weights: risk, threat, progress, safe, barrier, jail
const W = {
  cautious: { risk: 1.7, threat: 0.7, prog: 0.9, safe: 1.4, barrier: 1.5, jail: 1.1, opp: 0.8 },
  balanced: { risk: 1.0, threat: 1.0, prog: 1.0, safe: 1.0, barrier: 1.0, jail: 1.0, opp: 1.0 },
  bold: { risk: 0.35, threat: 1.7, prog: 1.25, safe: 0.5, barrier: 0.5, jail: 0.9, opp: 1.25 },
};

// chance that two fresh dice can reach exactly d squares (one die, the other die, or both on the same piece)
const HIT = (() => { const h = new Array(13).fill(0); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { const s = new Set([a, b, a + b]); for (const d of s) h[d] += 1 / 36; } return h; })();
const PAIR = 1 / 6;

// Probability that some rival can capture a piece standing on outer square t during their next roll.
function danger(g, pl, t) {
  if (isSafe(t) && !isSalida(t)) return 0;
  let keep = 1;
  g.pos.forEach((ps, o) => {
    if (o === pl) return;
    let jailed = false;
    ps.forEach((p) => {
      if (p < 0) { jailed = true; return; }
      const tr = trackIndex(g, o, p);
      if (tr == null || isSafe(t)) return;
      const d = (t - tr + T) % T;
      if (d > 0 && d <= 12 && p + d <= T - 1) keep *= 1 - HIT[d];
    });
    // a rival with a piece in jail captures whoever stands on ITS salida when a pair frees that piece
    if (jailed && trackIndex(g, o, 0) === t) keep *= 1 - PAIR;
  });
  return 1 - keep;
}

// how many squares ahead of t (within 12) a rival stands: used for "can I hit it next turn"
function evaluate(g, pl, w) {
  const map = trackMap(g);
  let s = 0;
  g.pos[pl].forEach((p) => {
    if (p < 0) { s -= 9 * w.jail; return; }
    if (p === END) { s += 85 * w.prog; return; }
    s += (p + 1) * w.prog;
    if (p >= T) { s += 5; return; }
    const t = trackIndex(g, pl, p), mine = (map.get(t) || []).filter(([o]) => o === pl).length;
    if (isSafe(t)) { s += 6 * w.safe; return; }
    if (mine >= 2) { s += 7 * w.barrier; return; }
    s -= danger(g, pl, t) * (p + 24) * w.risk;
  });
  // threats: rivals I could hit next roll
  g.pos.forEach((ps, o) => {
    if (o === pl) return;
    ps.forEach((p) => {
      const tr = trackIndex(g, o, p);
      if (tr == null || isSafe(tr)) return;
      let keep = 1;
      g.pos[pl].forEach((q) => { const mt = trackIndex(g, pl, q); if (mt == null) return; const d = (tr - mt + T) % T; if (d > 0 && d <= 12 && q + d <= T - 1) keep *= 1 - HIT[d]; });
      s += (1 - keep) * (p + 14) * 0.55 * w.threat;
    });
  });
  // rivals' fortunes, averaged
  const opps = g.pos.map((_, o) => o).filter((o) => o !== pl);
  let os = 0;
  for (const o of opps) os += progressOf(g, o) + g.pos[o].filter((p) => p === END).length * 30 - g.pos[o].filter((p) => p < 0).length * 9;
  s -= (os / Math.max(1, opps.length)) * 0.55 * w.opp;
  return s;
}

function cloneG(g) { return { ...g, pos: g.pos.map((a) => a.slice()) }; }

// every way of spending the remaining dice; each plan remembers its first action
function plans(g, pl, rem, pair, depth = 0) {
  const moves = legalMoves(g, rem, pair, pl);
  if (!moves.length) return [{ end: g, first: null }];
  const out = [];
  for (const m of moves) {
    const g2 = cloneG(g); applyMove(g2, m);
    const rem2 = rem.slice(); rem2[m.di] = null;
    if (g2.winner >= 0) { out.push({ end: g2, first: m, won: true }); continue; }
    for (const p of plans(g2, pl, rem2, pair, depth + 1)) out.push({ end: p.end, first: depth === 0 ? m : p.first, won: p.won });
  }
  return out;
}

// the computer's choice among legal actions for these dice (a move from legalMoves)
export function chooseMove(g, rem, pair, level, rng) {
  const pl = g.turn, moves = legalMoves(g, rem, pair, pl);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level === 'beginner' && !rng.chance(0.3)) return rng.pick(moves);
  const w = W[level] ?? W.balanced, noise = level === 'beginner' ? 0 : level === 'bold' ? 3.5 : 2;
  let best = null, bs = -1e9;
  for (const p of plans(g, pl, rem, pair)) {
    const sc = (p.won ? 1000 : evaluate(p.end, pl, w)) + rng.range(0, noise);
    if (sc > bs) { bs = sc; best = p.first; }
  }
  return best ?? moves[0];
}

// advice for the Hint button: the balanced planner without noise, plus a plain-language reason
export function hintMove(g, rem, pair, rng) {
  const m = chooseMove(g, rem, pair, 'balanced', { chance: () => false, pick: (a) => a[0], range: () => 0, next: () => 0, int: () => 0 });
  return m;
}
export function describeMove(g, m) {
  const t = trackIndex(g, m.pl, m.to);
  if (m.enter) return m.caps.length ? 'free a piece: it lands on your salida and captures the rival waiting there.' : 'free a piece from the cárcel onto your salida.';
  if (m.caps.length) return 'this move captures a rival and sends it to the cárcel.';
  if (m.to === END) return 'this piece reaches the corona.';
  if (m.to >= T) return 'this piece climbs the safe home lane.';
  if (t != null && isSafe(t)) return 'this piece lands on a safe seguro.';
  const mine = t != null ? trackMap(g).get(t) : null;
  if (mine && mine.some(([o]) => o === m.pl)) return 'this makes a barrier of two of your pieces.';
  return 'a sound move: it keeps your pieces safest.';
}
