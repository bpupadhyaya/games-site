// The Daily Race: the same position and the same six throws for everybody on a given day.
// The rival pawns stand still; you play the six throws; score = distance + 25 per capture + 40 per pawn home.
// The best possible score is found by trying every choice (at most 4^6 lines), so a star means something.
import { geo, newGame, trackIndex, legalMoves, applyMove, clone, throwOdds, rollThrow, isGrace } from './rules.js';
import { lcg } from './art.js';

export const DAILY_THROWS = 6;

export function makeDaily(day) {
  const rnd = lcg((day * 2654435761) >>> 0 ^ 0x9e3779b9);
  for (let n = 0; n < 5; n++) rnd();
  const g = newGame({ mode: 'pachisi', players: 2, pieces: 4, humans: [true, false] });
  const G = geo('pachisi');
  // my pawns: two or three out on the board, the rest waiting
  const out = 2 + Math.floor(rnd() * 2);
  const spots = new Set();
  for (let i = 0; i < 4; i++) {
    if (i < out) { let p; do { p = 1 + Math.floor(rnd() * 58); } while (spots.has(p)); spots.add(p); g.pos[0][i] = p; }
  }
  // rival singles placed 2-12 squares ahead of my pawns (unmarked squares), plus one rival block
  const odds = Object.keys(throwOdds('pachisi')).map(Number).filter((v) => v <= 12);
  const rivalStart = (G.A * 2 + G.R + 1) % G.T;
  const put = (t) => { const q = (t - rivalStart + G.T) % G.T; return q; };
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < 3; tries++) {
    const i = Math.floor(rnd() * out), d = odds[Math.floor(rnd() * odds.length)], t = trackIndex(g, 0, g.pos[0][i] + d);
    if (t == null || G.safe.has(t)) continue;
    const q = put(t);
    if (g.pos[1].includes(q)) continue;
    g.pos[1][placed] = q; placed++;
  }
  if (placed >= 2 && rnd() < 0.6) g.pos[1][placed - 1] = g.pos[1][placed - 2] + 0; // a rival block
  // the fixed throws (own stream so they are stable for the day)
  const fake = { chance: (p) => rnd() < p, shuffle: (a) => a.slice().sort(() => rnd() - 0.5), int: (n) => Math.floor(rnd() * n) };
  const throws = [];
  for (let k = 0; k < DAILY_THROWS; k++) throws.push(rollThrow('pachisi', fake).value);
  // make sure one grace throw exists so a waiting pawn matters
  if (!throws.some((v) => isGrace('pachisi', v))) throws[Math.floor(rnd() * DAILY_THROWS)] = 6;
  return { day, g, throws };
}

// points gained by a move
export const moveScore = (g, m) => (m.enter ? 1 : m.value) + 25 * m.caps.length + (m.to === geo(g.mode).END ? 40 : 0);

export function bestScore(daily) {
  const walk = (g, k) => {
    if (k >= daily.throws.length) return 0;
    const v = daily.throws[k], grace = isGrace(g.mode, v), ms = legalMoves(g, v, grace, 0);
    if (!ms.length) return walk(g, k + 1);
    let best = 0;
    for (const m of ms) { const h = clone(g); applyMove(h, m); best = Math.max(best, moveScore(g, m) + walk(h, k + 1)); }
    return best;
  };
  return walk(daily.g, 0);
}
export const starsFor = (score, best) => (best <= 0 ? 3 : score >= best ? 3 : score >= best * 0.8 ? 2 : score >= best * 0.55 ? 1 : 0);
